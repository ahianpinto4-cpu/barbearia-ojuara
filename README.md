# Barbearia Ojuara — Site institucional

Site premium da **Barbearia Ojuara** (São Cristóvão - SE), focado em converter visitantes em agendamentos pelo WhatsApp.

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Motion · Lucide.

## Como rodar

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de produção
npm start          # servir o build
```

## Publicação

Recomendado: **Vercel** (importe o repositório, sem configuração extra).
Defina a variável `NEXT_PUBLIC_SITE_URL` com o domínio final (ex.: `https://www.seudominio.com.br`) para que canonical, Open Graph, sitemap e dados estruturados usem a URL correta.

## Onde editar o conteúdo

**Tudo fica em [`src/config/site.ts`](src/config/site.ts):**

| O quê | Campo |
|---|---|
| Telefone / WhatsApp | `site.contact` |
| Endereço | `site.address` |
| Link oficial do Google (botão "Ver avaliações") | `site.links.googleBusinessProfile` |
| Instagram (@barber_oju) | `site.links.instagram` / `instagramHandle` |
| Logotipo | `public/brand/logo-header.webp` (cabeçalho) e `logo-full.webp` (rodapé); ícones em `src/app/icon.png` e `apple-icon.png`; imagem de compartilhamento usa `src/assets/logo-og.png` |
| Horário de funcionamento | `site.openingHoursText` |
| Serviços, preços e durações | `services` (preço `null` = "Valor sob consulta") |
| Barbeiros | `barbers` (lista vazia = etapa de barbeiro é pulada) |
| Fotos da galeria (somente cortes reais da Ojuara) | `gallery` → coloque os arquivos em `public/images/galeria/` |
| Avaliações reais do Google | `reviews` |
| Fotos de ambientação (hero, sobre, CTA) | `ambientImages` |
| Dias fechados no calendário | `bookingConfig.closedWeekdays` / `closedDates` |
| Etiquetas de "conteúdo provisório" | `site.showPlaceholderHints` → `false` quando tudo estiver preenchido |

### Pendências de conteúdo (não inventadas de propósito)

- [ ] Serviços, preços e durações reais (os 3 atuais estão marcados como provisórios).
- [ ] 8+ fotos reais de cortes para a galeria.
- [ ] Fotos dos serviços (opcional).
- [ ] Fotos profissionais do espaço para substituir as imagens ilustrativas do Unsplash em `ambientImages`.
- [ ] Link oficial do perfil no Google Maps.
- [ ] Horário de funcionamento e dias fechados.
- [ ] Nomes dos barbeiros (se houver mais de um).
- [ ] Avaliações reais do Google (copiadas com autorização).

## Agendamento

O assistente (serviço → barbeiro → data → horário → dados → resumo) gera uma mensagem organizada e abre o WhatsApp com ela.
Sem agenda integrada, **o horário é uma solicitação** que a barbearia confirma — o site nunca exibe horários como "disponíveis".

Para integrar uma agenda real no futuro, implemente `AvailabilityProvider` em
[`src/lib/booking/availability.ts`](src/lib/booking/availability.ts) (há um exemplo comentado chamando `/api/disponibilidade`).
Se o provedor retornar `{ mode: "slots", slots: [...] }`, o modal passa a exibir a grade de horários reais automaticamente.

## Estrutura

```
src/
  app/            layout (SEO, fontes, JSON-LD), página, OG image, sitemap, robots, manifest
  config/site.ts  dados editáveis centralizados
  lib/            links (WhatsApp, Maps), SEO, regras de agendamento
  components/
    sections/     Hero, About, Services, Gallery, Reviews, BookingCTA, Location
    booking/      Provider, modal em etapas, calendário, gatilho
    layout/       Header (menu mobile), Footer, botão flutuante do WhatsApp
    ui/           botões, reveal, imagem com fallback, contador, estrelas, logo
```

## Observações de SEO

- Dados estruturados `BarberShop` apenas com informações verificadas. A nota 4,9 **não** entra no JSON-LD, pois o Google exige o número de avaliações (não informado) e não exibe avaliações autodeclaradas de negócios locais.
- Animações respeitam a preferência "reduzir movimento" do sistema.
