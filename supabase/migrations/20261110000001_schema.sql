-- =============================================================================
-- Barbearia Ojuara — esquema principal
-- Fuso horário de referência: America/Maceio (São Cristóvão - SE, UTC-3, sem horário de verão)
-- =============================================================================

create extension if not exists btree_gist;
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Utilitário: updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.appointment_status as enum
  ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show');

create type public.appointment_source as enum ('whatsapp', 'site', 'admin', 'walk_in');

create type public.conversation_status as enum
  ('AI_ACTIVE', 'HUMAN_REQUESTED', 'HUMAN_ACTIVE', 'AI_PAUSED', 'AI_RESUMED');

create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_sender as enum ('customer', 'ai', 'human', 'system');

create type public.notification_kind as enum
  ('confirmation', 'reminder_24h', 'reminder_2h', 'cancellation');

create type public.job_status as enum ('pending', 'sent', 'failed', 'skipped', 'cancelled');

-- -----------------------------------------------------------------------------
-- settings: configurações chave/valor editáveis pelo painel
-- -----------------------------------------------------------------------------
create table public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- customers: identificados pelo telefone do WhatsApp (somente dígitos, com DDI)
-- -----------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  phone text not null unique check (phone ~ '^[0-9]{10,15}$'),
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- barbers
-- working_hours: { "0".."6": [ {"start":"09:00","end":"12:00"}, ... ] }
--   0 = domingo … 6 = sábado. Intervalos separados representam pausas.
--   Dia ausente ou lista vazia = não trabalha.
-- -----------------------------------------------------------------------------
create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  active boolean not null default true,
  working_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(working_hours) = 'object'),
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger barbers_updated_at before update on public.barbers
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- services (exclusão lógica via deleted_at)
-- price null = "valor sob consulta"; duration_minutes é obrigatório para agendar
-- -----------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  description text,
  price numeric(10, 2) check (price is null or price >= 0),
  duration_minutes int check (duration_minutes is null or duration_minutes between 5 and 480),
  active boolean not null default true,
  sort_order int not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- business_hours: funcionamento geral da barbearia
-- -----------------------------------------------------------------------------
create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null unique check (day_of_week between 0 and 6),
  opening_time time not null,
  closing_time time not null,
  active boolean not null default true,
  check (closing_time > opening_time)
);

-- -----------------------------------------------------------------------------
-- appointments
-- start_at/end_at (timestamptz) são a fonte da verdade; appointment_date,
-- start_time e end_time guardam o horário local (America/Maceio) para consulta.
-- -----------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers (id) on delete set null,
  barber_id uuid not null references public.barbers (id),
  service_id uuid not null references public.services (id),
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status public.appointment_status not null default 'confirmed',
  source public.appointment_source not null,
  price numeric(10, 2),
  customer_name text,
  notes text,
  is_test boolean not null default false,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at),
  -- Proteção definitiva contra reservas conflitantes: o mesmo barbeiro não pode
  -- ter dois atendimentos ativos com intervalos sobrepostos, mesmo com durações
  -- diferentes e mesmo sob requisições simultâneas.
  constraint appointments_no_overlap exclude using gist (
    barber_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status in ('pending', 'confirmed', 'in_progress'))
);
create index appointments_barber_start_idx on public.appointments (barber_id, start_at);
create index appointments_date_idx on public.appointments (appointment_date);
create index appointments_customer_idx on public.appointments (customer_id, start_at desc);
create trigger appointments_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- blocked_slots: bloqueios manuais (barber_id nulo = bloqueia todos)
-- -----------------------------------------------------------------------------
create table public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid references public.barbers (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_by text,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index blocked_slots_range_idx on public.blocked_slots using gist (tstzrange(start_at, end_at, '[)'));
create index blocked_slots_barber_idx on public.blocked_slots (barber_id, start_at);

-- -----------------------------------------------------------------------------
-- conversations / messages (WhatsApp)
-- -----------------------------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null unique references public.customers (id) on delete cascade,
  status public.conversation_status not null default 'AI_ACTIVE',
  assigned_to text,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  unread_count int not null default 0,
  needs_attention boolean not null default false,
  handoff_reason text,
  processing_until timestamptz,
  is_test boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index conversations_last_message_idx on public.conversations (last_message_at desc);
create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction public.message_direction not null,
  sender public.message_sender not null,
  content text not null,
  message_type text not null default 'text',
  whatsapp_message_id text unique,
  status text not null default 'received',
  error jsonb,
  created_at timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at);

-- -----------------------------------------------------------------------------
-- admin_users: acesso ao painel (senha com scrypt, nunca em texto puro)
-- -----------------------------------------------------------------------------
create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  name text not null,
  password_hash text not null,
  role text not null default 'owner' check (role in ('owner', 'staff')),
  active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- notification_jobs: lembretes/confirmações com controle anti-duplicidade
-- -----------------------------------------------------------------------------
create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  kind public.notification_kind not null,
  scheduled_for timestamptz not null,
  status public.job_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  whatsapp_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (appointment_id, kind)
);
create index notification_jobs_due_idx on public.notification_jobs (status, scheduled_for);

-- -----------------------------------------------------------------------------
-- event_logs: registro de eventos e erros de integração
-- -----------------------------------------------------------------------------
create table public.event_logs (
  id bigint generated always as identity primary key,
  level text not null check (level in ('debug', 'info', 'warn', 'error')),
  type text not null,
  message text not null,
  data jsonb,
  created_at timestamptz not null default now()
);
create index event_logs_created_idx on public.event_logs (created_at desc);
create index event_logs_type_idx on public.event_logs (type, created_at desc);

-- -----------------------------------------------------------------------------
-- Segurança (Supabase): RLS ativo e SEM políticas para anon/authenticated.
-- Nenhuma tabela fica exposta pela API pública (PostgREST) com a chave anon.
-- Todo acesso passa pelo backend (Next.js), que conecta com DATABASE_URL.
-- -----------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.customers enable row level security;
alter table public.barbers enable row level security;
alter table public.services enable row level security;
alter table public.business_hours enable row level security;
alter table public.appointments enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.admin_users enable row level security;
alter table public.notification_jobs enable row level security;
alter table public.event_logs enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    revoke execute on all functions in schema public from anon, authenticated;
  end if;
end $$;
