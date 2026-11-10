-- =============================================================================
-- DADOS FICTÍCIOS — SOMENTE PARA DESENVOLVIMENTO/TESTES. NÃO RODAR EM PRODUÇÃO.
-- Nomes, preços e horários abaixo NÃO são da Barbearia Ojuara.
-- =============================================================================
insert into public.business_hours (day_of_week, opening_time, closing_time, active) values
  (1, '09:00', '19:00', true), (2, '09:00', '19:00', true), (3, '09:00', '19:00', true),
  (4, '09:00', '19:00', true), (5, '09:00', '19:00', true), (6, '08:00', '14:00', true)
on conflict (day_of_week) do nothing;

update public.services set active = false;
insert into public.services (name, description, price, duration_minutes, active, sort_order) values
  ('[TESTE] Corte', 'Serviço fictício para testes', 40.00, 30, true, 10),
  ('[TESTE] Corte + Barba', 'Serviço fictício para testes', 60.00, 60, true, 11);

insert into public.barbers (name, active, working_hours, sort_order) values
  ('[TESTE] Barbeiro A', true,
   '{"1":[{"start":"09:00","end":"12:00"},{"start":"13:00","end":"19:00"}],"2":[{"start":"09:00","end":"12:00"},{"start":"13:00","end":"19:00"}],"3":[{"start":"09:00","end":"12:00"},{"start":"13:00","end":"19:00"}],"4":[{"start":"09:00","end":"12:00"},{"start":"13:00","end":"19:00"}],"5":[{"start":"09:00","end":"12:00"},{"start":"13:00","end":"19:00"}],"6":[{"start":"08:00","end":"14:00"}]}', 1),
  ('[TESTE] Barbeiro B', true,
   '{"2":[{"start":"13:00","end":"19:00"}],"4":[{"start":"13:00","end":"19:00"}],"6":[{"start":"08:00","end":"14:00"}]}', 2);
