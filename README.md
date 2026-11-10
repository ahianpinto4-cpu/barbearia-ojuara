# Barbearia Ojuara — site, assistente de WhatsApp e painel

Presença digital completa da **Barbearia Ojuara** (São Cristóvão - SE):

- **Site premium** com abertura cinematográfica em 3D (máquina de corte modelada em Three.js), identidade visual original preservada e foco em levar o visitante ao WhatsApp.
- **Atendimento automatizado pelo WhatsApp** (WhatsApp Business Platform / Cloud API oficial da Meta) com **assistente virtual (Claude API)** que consulta a agenda real, agenda, cancela e reagenda.
- **Atendimento humano** (modelo híbrido): o cliente pode pedir uma pessoa e a equipe assume a conversa pelo painel.
- **Painel administrativo** com agenda, atendimento presencial (ordem de chegada), bloqueios, serviços, barbeiros, conversas, configurações e simulador.
- **Banco PostgreSQL (Supabase)** com proteção transacional contra reservas conflitantes.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Motion · Three.js + React Three Fiber · PostgreSQL (Supabase) · `@anthropic-ai/sdk` · Vitest.

---

## Situação de cada parte

| Parte | Situação |
|---|---|
| Site, abertura 3D, responsividade, SEO | ✅ Implementado e testado (desktop e celular, com/sem WebGL, “reduzir movimento”) |
| Banco de dados (migrations, regras, anti-conflito) | ✅ Implementado e testado contra PostgreSQL 16 real |
| Agenda: disponibilidade, agendar, cancelar, reagendar, presencial, bloqueios | ✅ Implementado e testado (inclui teste de 6 reservas simultâneas: só 1 vence) |
| Painel administrativo e login | ✅ Implementado e testado no navegador |
| Webhook da Meta (verificação, assinatura, deduplicação, status) | ✅ Implementado e testado com payloads assinados · ⏳ **depende de credenciais da Meta** para tráfego real |
| Envio de mensagens (Cloud API) | ✅ Implementado · ⏳ **depende de credenciais da Meta**. Testado em modo `WHATSAPP_DRY_RUN` |
| Assistente virtual (Claude) | ✅ Implementado; loop de ferramentas testado com cliente roteirizado · ⏳ **depende de `CLAUDE_API_KEY`** para respostas reais |
| Transferência humana, pausa e retomada da IA | ✅ Implementado e testado |
| Lembretes (24 h / 2 h) | ✅ Implementado e testado (anti-duplicidade, janela de 24 h) · ⏳ **templates precisam ser aprovados pela Meta** |
| Número de teste do responsável | ⏳ **Pendente**: o número informado (79 9664 8360) tem 10 dígitos e parece incompleto. Nenhum dígito foi inventado; informe o número completo no painel |

> Sem as credenciais externas, o sistema **não finge** funcionar: sem a chave da Claude, toda mensagem é transferida para a equipe com um aviso educado; sem as credenciais da Meta, nada é enviado e o erro fica registrado.

---

## Rodando localmente

Requisitos: Node 20+ e um PostgreSQL (local ou Supabase).

```bash
npm install
cp .env.example .env.local      # preencha DATABASE_URL e SESSION_SECRET
npm run db:migrate              # cria as tabelas
npm run db:seed-dev             # (opcional) dados FICTÍCIOS de teste: [TESTE] barbeiros/serviços
npm run admin:create -- voce@email.com "Seu Nome" owner
npm run dev                     # http://localhost:3000  ·  painel em /admin
```

Testes automatizados (precisam de um PostgreSQL; o banco `ojuara_test` é recriado a cada execução):

```bash
TEST_DATABASE_URL=postgres://usuario@localhost:5432/ojuara_test npm test
npm run lint && npm run typecheck && npm run build
```

---

## Publicação (Vercel + Supabase)

### 1. Supabase (banco de dados)
1. Crie um projeto em <https://supabase.com> (região São Paulo).
2. **Project Settings → Database → Connection string → Transaction pooler** (porta 6543). Essa é a `DATABASE_URL`.
3. Rode as migrations a partir do seu computador:
   ```bash
   DATABASE_URL="postgresql://..." npm run db:migrate
   DATABASE_URL="postgresql://..." npm run admin:create -- email@dominio.com "Nome" owner
   ```
   Alternativa: cole os arquivos de `supabase/migrations/` no **SQL Editor**, em ordem.
4. Segurança: todas as tabelas têm **RLS ativo e nenhuma política pública** — a chave `anon` não lê nada. Somente o backend acessa o banco.

### 2. Vercel
1. Importe o repositório e configure as variáveis de **`.env.example`** em *Settings → Environment Variables*.
2. Gere segredos fortes: `openssl rand -base64 48` (para `SESSION_SECRET`, `CRON_SECRET`, `META_VERIFY_TOKEN`).
3. Deploy. O painel fica em `https://seu-dominio/admin`.

### 3. Meta — WhatsApp Business Platform (Cloud API)
1. Em <https://developers.facebook.com> crie um app do tipo **Business** e adicione o produto **WhatsApp**.
2. Em *WhatsApp → API Setup*: copie o **Phone Number ID** (`META_PHONE_NUMBER_ID`) e gere um **token permanente** via *System User* no Business Manager (`META_WHATSAPP_TOKEN`). O token temporário expira em 24 h.
3. Em *App Settings → Basic*: copie o **App Secret** (`META_APP_SECRET`) — usado para validar a assinatura de cada webhook.
4. Em *WhatsApp → Configuration → Webhook*:
   - Callback URL: `https://seu-dominio/api/whatsapp/webhook`
   - Verify token: o mesmo valor de `META_VERIFY_TOKEN`
   - Assine o campo **messages**.
5. **Testes:** no API Setup, cadastre o número do responsável em *To* (destinatários de teste) — a Meta só entrega mensagens do número de teste para números cadastrados ali. Defina `NEXT_PUBLIC_WHATSAPP_NUMBER` com o número de teste da Meta para os botões do site abrirem a conversa certa.
6. **Produção:** adicione o número oficial **+55 79 99934-5023** à conta do WhatsApp Business Platform.
   > ⚠️ Um número registrado na Cloud API deixa de funcionar no aplicativo WhatsApp Business comum, a menos que a Meta habilite a *coexistência* para a conta. Avalie isso antes de migrar o número oficial (ou use um número dedicado ao atendimento automático).
7. **Templates:** para lembretes e mensagens fora da janela de 24 h, crie e aprove templates no *WhatsApp Manager* e informe os nomes no painel (*Configurações → Lembretes e templates*). Parâmetros do corpo, nesta ordem: `{{1}}` nome, `{{2}}` data, `{{3}}` horário, `{{4}}` serviço, `{{5}}` profissional.

### 4. Claude API
Crie uma chave em <https://console.anthropic.com> e defina `CLAUDE_API_KEY`. Modelo padrão: `claude-opus-5-5` (ajustável em `CLAUDE_MODEL`). O fallback de recusa no servidor (`fallbacks: "default"`) está habilitado.

### 5. Lembretes (cron)
`vercel.json` agenda `/api/cron/reminders` uma vez por dia (limite do plano gratuito da Vercel). Para os lembretes de **2 h antes**, use um agendador que rode a cada 10–15 min — por exemplo <https://cron-job.org> (gratuito) — chamando:
```
GET https://seu-dominio/api/cron/reminders
Authorization: Bearer <CRON_SECRET>
```

---

## Modo TESTE x PRODUÇÃO

Alternado no painel (*Configurações → WhatsApp*), sem mexer em código.

| | TESTE | PRODUÇÃO |
|---|---|---|
| Quem conversa com o assistente | Somente o número autorizado do responsável | Qualquer cliente |
| Mensagens de outros números | Ignoradas e **não gravadas** | Atendidas normalmente |
| Agendamentos | Marcados como **teste** (apagáveis em um clique) | Reais |
| Alertas para a equipe | Número de teste | Número oficial 79 99934-5023 |

- O **número de origem** (de onde saem as mensagens) é o `META_PHONE_NUMBER_ID`; o **número de destino** é configurado separadamente.
- O número de teste precisa ter 13 dígitos (55 + DDD + 9 dígitos). O painel recusa números incompletos.
- `WHATSAPP_DRY_RUN=true` impede qualquer envio real (útil em desenvolvimento).
- O **Simulador** do painel conversa com o assistente usando a agenda real, sem WhatsApp.

---

## Como o atendimento funciona

1. O visitante toca em **Agendar pelo WhatsApp** → o WhatsApp abre com a mensagem pronta.
2. A Meta envia a mensagem ao webhook → assinatura verificada → mensagem gravada (duplicadas ignoradas) → resposta 200 imediata e processamento em seguida.
3. Se a conversa estiver com humano/pausada, a IA fica em silêncio e o painel sinaliza “precisa de atenção”.
4. Pedidos como “quero falar com uma pessoa” transferem na hora (mesmo sem IA): estado `HUMAN_REQUESTED`, aviso ao cliente e alerta à equipe.
5. Caso contrário, o assistente (Claude) conversa e usa **ferramentas do backend** — ele nunca acessa o banco diretamente:
   `consultar_informacoes_barbearia`, `consultar_servicos`, `consultar_precos`, `consultar_barbeiros`, `consultar_disponibilidade`, `criar_agendamento`, `consultar_agendamento`, `cancelar_agendamento`, `reagendar_agendamento`, `solicitar_atendimento_humano`.
6. Regras garantidas pelo backend: agendar/cancelar/reagendar exige `cliente_confirmou=true`; disponibilidade recalculada dentro da transação; cliente só altera os próprios agendamentos; preços, barbeiros e horários vêm só do banco.
7. Após o sucesso, o cliente recebe a confirmação no formato oficial (data, horário, serviço, profissional, valor).

Estados da conversa: `AI_ACTIVE`, `HUMAN_REQUESTED`, `HUMAN_ACTIVE`, `AI_PAUSED`, `AI_RESUMED`.

### Proteção contra reservas conflitantes
- Restrição de exclusão no PostgreSQL (`btree_gist`): o mesmo barbeiro não pode ter dois atendimentos ativos com intervalos sobrepostos — vale para durações diferentes e para requisições simultâneas.
- Além disso, cada reserva trava a linha do barbeiro (`FOR UPDATE`) e revalida a disponibilidade antes de gravar.
- Atendimentos presenciais e bloqueios entram no mesmo cálculo: a IA nunca oferece esses intervalos.

---

## Primeiros passos no painel (antes de ligar a IA para clientes)

1. **Configurações → Horário de funcionamento**: cadastre os horários reais.
2. **Barbeiros**: cadastre os profissionais e as jornadas (dois turnos por dia; o intervalo vira pausa).
3. **Serviços**: os 3 serviços iniciais estão **inativos e sem preço/duração** (não foram inventados). Preencha os valores reais e ative.
4. **Configurações → WhatsApp**: informe o número de teste completo.
5. **Simulador**: converse com o assistente e confira as respostas.
6. Só então mude para **Produção**.

---

## Conteúdo do site ainda pendente

Em `src/config/site.ts` (o site usa os serviços do painel quando houver serviços ativos):

- [ ] Fotos reais de cortes para a galeria (8 espaços reservados).
- [ ] Fotos do espaço para substituir as imagens ilustrativas de ambientação.
- [ ] Link oficial do perfil no Google Maps (`links.googleBusinessProfile`).
- [ ] Avaliações reais do Google (com autorização).
- [ ] Quando tudo estiver preenchido: `showPlaceholderHints: false`.

---

## Abertura 3D

- Máquina de corte modelada **somente com geometria do Three.js** (`src/components/animations/clipperModel.ts`): corpo torneado de seção oval, pegada, anéis dourados, cabeça com lâmina e 28 dentes instanciados, alavanca, botão vermelho da marca e gravação “OJUARA”. Nenhum modelo externo.
- Sequência: aparecimento com luz dourada → queda com gravidade → impacto (“puf”, faíscas douradas e vermelhas, onda de expansão, poeira, tremor de câmera, som opcional sintetizado) → revelação da logo + “SEU ESTILO COMEÇA AQUI.” → dissolução.
- Toca só na **primeira visita** (localStorage), respeita **reduzir movimento**, tem **PULAR INTRO** (e Esc), versão 2D sem WebGL, e o link **Rever abertura** no rodapé. O Three.js só é baixado quando a abertura toca.
- Desativar em um acesso específico: `/?intro=0`.

---

## Estrutura

```
src/
  app/
    page.tsx                 site (serviços vindos do painel, revalidação de 5 min)
    admin/                   painel (login + páginas protegidas em (painel)/)
    api/whatsapp/webhook/    webhook oficial da Meta
    api/cron/reminders/      lembretes
  components/
    animations/              abertura 3D (Intro, ClipperScene, clipperModel)
    sections/ layout/ ui/    site
    admin/                   componentes do painel
  lib/
    ai/                      prompt, ferramentas validadas e loop da Claude API
    whatsapp/                cliente Cloud API, webhook, modos, processamento
    server/                  banco, agenda, conversas, lembretes, auth, settings
    booking/engine.ts        cálculo de horários (função pura)
  config/site.ts             dados públicos do site
supabase/migrations/         esquema SQL versionado
supabase/seed.dev.sql        dados fictícios (somente desenvolvimento)
tests/                       50 testes (unitários + integração com PostgreSQL)
```
