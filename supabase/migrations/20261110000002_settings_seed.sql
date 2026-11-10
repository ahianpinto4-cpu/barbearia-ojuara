-- Configurações iniciais. Nenhum dado inventado: horários, serviços e barbeiros
-- reais devem ser cadastrados pelo painel administrativo.
insert into public.settings (key, value) values
  ('whatsapp_mode', '"test"'),
  ('test_recipient', '""'),
  ('production_recipient', '"5579999345023"'),
  ('ai_enabled', 'true'),
  ('slot_interval_minutes', '15'),
  ('min_notice_minutes', '60'),
  ('max_days_ahead', '30'),
  ('assistant_extra_instructions', '""'),
  ('greeting_message', '"Olá! Seja muito bem-vindo à Barbearia Ojuara! 💈\nSou o assistente virtual da barbearia e estou aqui para facilitar seu atendimento.\nVocê pode consultar nossos serviços, verificar horários disponíveis e agendar seu próximo corte por aqui mesmo.\nComo posso te ajudar?"'),
  ('handoff_message', '"Certo! Já avisei a equipe da Barbearia Ojuara e um atendente vai continuar a conversa com você por aqui assim que possível. 💈"'),
  ('reminder_templates', '{"confirmation": null, "reminder_24h": null, "reminder_2h": null, "cancellation": null, "admin_alert": null, "language": "pt_BR"}')
on conflict (key) do nothing;

-- Serviços iniciais INATIVOS e sem preço/duração: precisam ser confirmados pela
-- barbearia no painel antes de aparecerem para o assistente.
insert into public.services (name, description, price, duration_minutes, active, sort_order) values
  ('Corte de cabelo', 'Corte pensado para o seu formato de rosto e para a sua rotina, com acabamento preciso.', null, null, false, 1),
  ('Barba', 'Desenho, alinhamento e acabamento da barba para valorizar seus traços.', null, null, false, 2),
  ('Corte + Barba', 'O cuidado completo em um único atendimento: cabelo e barba em harmonia.', null, null, false, 3);
