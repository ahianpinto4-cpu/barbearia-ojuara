/**
 * Tipos do fluxo de agendamento.
 * Mantidos independentes da UI para permitir, no futuro, persistir a
 * solicitação em um banco de dados ou API sem alterar os componentes.
 */

export type BookingRequest = {
  serviceId: string;
  serviceName: string;
  barberId: string | null;
  barberName: string | null;
  /** Data no formato ISO "AAAA-MM-DD". */
  date: string;
  /** Período escolhido (ex.: "Tarde") e/ou horário específico ("15:30"). */
  period: string | null;
  time: string | null;
  customerName: string;
  customerPhone: string;
};

/** Um horário retornado por uma agenda real (quando houver integração). */
export type TimeSlot = {
  time: string; // "HH:MM"
  available: boolean;
};

/**
 * Resultado da consulta de disponibilidade.
 * - `mode: "request"` → não há agenda integrada; o cliente informa uma
 *   preferência e a barbearia confirma pelo WhatsApp.
 * - `mode: "slots"`   → agenda integrada devolve horários reais.
 */
export type AvailabilityResult =
  | { mode: "request" }
  | { mode: "slots"; slots: TimeSlot[] };
