/**
 * ============================================================================
 *  BARBEARIA OJUARA — CONFIGURAÇÃO CENTRAL DO SITE
 * ============================================================================
 *  Tudo o que é editável (contato, endereço, serviços, preços, barbeiros,
 *  fotos, avaliações e links) fica neste arquivo. Altere aqui e o site inteiro
 *  é atualizado — inclusive mensagens do WhatsApp, SEO e dados estruturados.
 *
 *  REGRA DE OURO: só publique informações confirmadas pela barbearia.
 *  Campos com `null` ou listas vazias são tratados automaticamente pelo layout
 *  (ex.: preço `null` aparece como "Valor sob consulta").
 * ============================================================================
 */

export type Service = {
  /** Identificador único (sem espaços). Usado em URLs e no agendamento. */
  id: string;
  name: string;
  description: string;
  /** Preço em reais (ex.: 45). `null` = "Valor sob consulta". */
  price: number | null;
  /** Duração em minutos (ex.: 40). `null` = não exibe. */
  durationMinutes: number | null;
  /** Foto do serviço em /public (ex.: "/images/servicos/corte.webp"). `null` = espaço reservado. */
  image: string | null;
  /** `true` enquanto nome/descrição não forem confirmados pela barbearia. */
  provisional: boolean;
};

export type Barber = {
  id: string;
  name: string;
  /** Ex.: "Especialista em degradê". Deixe `null` se não houver. */
  specialty: string | null;
  photo: string | null;
};

export type GalleryItem = {
  id: string;
  /** Foto REAL de um corte da Ojuara em /public (ex.: "/images/galeria/01.webp"). `null` = espaço reservado. */
  src: string | null;
  /** Descreva o corte para acessibilidade e SEO (ex.: "Degradê baixo com risca lateral"). */
  alt: string;
  /** Nome do estilo exibido na legenda (opcional). */
  caption: string | null;
  /** Formato no grid: "tall" ocupa 2 linhas, "wide" ocupa 2 colunas (desktop). */
  shape: "square" | "tall" | "wide";
};

export type Review = {
  author: string;
  text: string;
  rating: number;
  /** Ex.: "há 2 semanas" — copie exatamente como aparece no Google. */
  when: string | null;
};

export const site = {
  name: "Barbearia Ojuara",
  shortName: "Ojuara",
  description:
    "Há mais de 5 anos transformando cortes em identidade. Atendimento profissional, atenção aos detalhes e avaliação de 4,9 estrelas no Google, em São Cristóvão - SE.",

  /**
   * Exibe etiquetas discretas nos conteúdos provisórios (fotos, serviços,
   * avaliações). Mude para `false` quando todo o conteúdo real estiver cadastrado.
   */
  showPlaceholderHints: true,

  /** Dados de credibilidade — somente informações verificadas. */
  yearsInBusiness: 5,
  rating: 4.9,

  contact: {
    /** Somente dígitos, com DDI 55 + DDD. */
    whatsappNumber: "5579999345023",
    phoneDisplay: "(79) 99934-5023",
    phoneE164: "+55 79 99934-5023",
  },

  address: {
    street: "R. Amariy Correia, 52",
    neighborhood: "Rosa Elze",
    city: "São Cristóvão",
    state: "SE",
    postalCode: "49107-254",
    country: "BR",
    full: "R. Amariy Correia, 52 - Rosa Elze, São Cristóvão - SE, 49107-254",
  },

  links: {
    /**
     * Link OFICIAL do perfil no Google Maps (botão "Ver avaliações no Google").
     * Cole aqui o link de compartilhamento do perfil (ex.: "https://maps.app.goo.gl/...").
     * Enquanto estiver `null`, o site usa uma busca pelo nome + endereço.
     */
    googleBusinessProfile: null as string | null,
    /** Instagram oficial. `null` = oculto. */
    instagram: "https://www.instagram.com/barber_oju/" as string | null,
    instagramHandle: "@barber_oju",
  },

  /** Horário de funcionamento. Deixe `null` até a barbearia confirmar. */
  openingHoursText: null as string | null,

  /**
   * Mensagens pré-preenchidas do WhatsApp.
   */
  messages: {
    general:
      "Olá! Conheci a Barbearia Ojuara pelo site e gostaria de agendar um horário. Poderiam me informar a disponibilidade?",
    service: (serviceName: string) =>
      `Olá! Conheci a Barbearia Ojuara pelo site e gostaria de agendar o serviço "${serviceName}". Poderiam me informar a disponibilidade?`,
  },
} as const;

/**
 * SERVIÇOS
 * ----------------------------------------------------------------------------
 * Estrutura inicial PROVISÓRIA (marcada com `provisional: true`).
 * Substitua pelos serviços, preços e durações reais da Ojuara.
 */
export const services: Service[] = [
  {
    id: "corte",
    name: "Corte de cabelo",
    description:
      "Corte pensado para o seu formato de rosto e para a sua rotina, com acabamento preciso.",
    price: null,
    durationMinutes: null,
    image: null,
    provisional: true,
  },
  {
    id: "barba",
    name: "Barba",
    description:
      "Desenho, alinhamento e acabamento da barba para valorizar seus traços.",
    price: null,
    durationMinutes: null,
    image: null,
    provisional: true,
  },
  {
    id: "corte-e-barba",
    name: "Corte + Barba",
    description:
      "O cuidado completo em um único atendimento: cabelo e barba em harmonia.",
    price: null,
    durationMinutes: null,
    image: null,
    provisional: true,
  },
];

/**
 * BARBEIROS
 * ----------------------------------------------------------------------------
 * Lista vazia = a etapa "Escolha o barbeiro" é pulada no agendamento.
 * Exemplo: { id: "joao", name: "João", specialty: null, photo: null }
 */
export const barbers: Barber[] = [];

/**
 * GALERIA — use SOMENTE fotos reais de cortes feitos na Barbearia Ojuara.
 * ----------------------------------------------------------------------------
 * Coloque os arquivos em /public/images/galeria e preencha `src`, `alt` e `caption`.
 * Formato recomendado: WebP ou AVIF, ~1600px no maior lado.
 */
export const gallery: GalleryItem[] = [
  { id: "g01", src: null, alt: "Foto real de corte da Barbearia Ojuara (01)", caption: null, shape: "tall" },
  { id: "g02", src: null, alt: "Foto real de corte da Barbearia Ojuara (02)", caption: null, shape: "square" },
  { id: "g03", src: null, alt: "Foto real de corte da Barbearia Ojuara (03)", caption: null, shape: "square" },
  { id: "g04", src: null, alt: "Foto real de corte da Barbearia Ojuara (04)", caption: null, shape: "tall" },
  { id: "g05", src: null, alt: "Foto real de corte da Barbearia Ojuara (05)", caption: null, shape: "wide" },
  { id: "g06", src: null, alt: "Foto real de corte da Barbearia Ojuara (06)", caption: null, shape: "square" },
  { id: "g07", src: null, alt: "Foto real de corte da Barbearia Ojuara (07)", caption: null, shape: "square" },
  { id: "g08", src: null, alt: "Foto real de corte da Barbearia Ojuara (08)", caption: null, shape: "wide" },
];

/**
 * AVALIAÇÕES REAIS DO GOOGLE
 * ----------------------------------------------------------------------------
 * Copie avaliações reais (com autorização) do perfil no Google. Nunca invente.
 * Lista vazia = exibe espaços reservados (se `showPlaceholderHints` estiver ativo).
 */
export const reviews: Review[] = [];

/**
 * FOTOGRAFIAS DE AMBIENTAÇÃO
 * ----------------------------------------------------------------------------
 * Imagens ILUSTRATIVAS de banco de imagens (Unsplash), usadas apenas para
 * ambientação visual — não representam trabalhos da Ojuara.
 * Recomendado: substituir por fotos profissionais do próprio espaço,
 * salvando em /public/images e trocando `src` pelo caminho local
 * (ex.: "/images/hero.webp").
 */
export const ambientImages = {
  hero: {
    src: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1",
    alt: "Barbeiro finalizando um corte masculino com precisão",
  },
  about: {
    src: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70",
    alt: "Ambiente de barbearia com cadeiras clássicas e iluminação quente",
  },
  aboutDetail: {
    src: "https://images.unsplash.com/photo-1621605815971-fbc98d665033",
    alt: "Detalhe de barbeiro trabalhando com navalha e pente",
  },
  cta: {
    src: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a",
    alt: "Cadeira de barbeiro em ambiente escuro e sofisticado",
  },
} as const;

/**
 * CONFIGURAÇÃO DO AGENDAMENTO
 * ----------------------------------------------------------------------------
 * Sem integração com agenda, o horário escolhido é uma SOLICITAÇÃO que a
 * barbearia confirma pelo WhatsApp. Para disponibilidade real, implemente um
 * `AvailabilityProvider` em src/lib/booking/availability.ts.
 */
export const bookingConfig = {
  /** Quantos dias à frente o calendário permite escolher. */
  maxDaysAhead: 60,
  /** Dias da semana fechados (0 = domingo … 6 = sábado). Vazio até confirmar. */
  closedWeekdays: [] as number[],
  /** Datas específicas fechadas (feriados), formato "AAAA-MM-DD". */
  closedDates: [] as string[],
  /** Períodos de preferência oferecidos quando não há agenda integrada. */
  periods: [
    { id: "manha", label: "Manhã" },
    { id: "tarde", label: "Tarde" },
    { id: "noite", label: "Noite" },
  ],
};

export const navLinks = [
  { href: "#sobre", label: "Sobre" },
  { href: "#servicos", label: "Serviços" },
  { href: "#galeria", label: "Galeria" },
  { href: "#avaliacoes", label: "Avaliações" },
  { href: "#localizacao", label: "Localização" },
] as const;
