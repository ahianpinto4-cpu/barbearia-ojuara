import { whatsappLink } from "@/lib/links";
import { formatDateShort } from "./availability";
import type { BookingRequest } from "./types";

export function describeTime(req: Pick<BookingRequest, "period" | "time">): string {
  if (req.time && req.period) return `${req.time} (${req.period.toLowerCase()})`;
  if (req.time) return req.time;
  if (req.period) return `Período da ${req.period.toLowerCase()} (horário a combinar)`;
  return "A combinar";
}

/** Monta a mensagem organizada enviada pelo cliente no WhatsApp. */
export function buildBookingMessage(req: BookingRequest): string {
  return [
    "Olá! Gostaria de solicitar um agendamento na Barbearia Ojuara.",
    "",
    `Nome: ${req.customerName.trim()}`,
    `Telefone: ${req.customerPhone.trim()}`,
    `Serviço: ${req.serviceName}`,
    `Barbeiro: ${req.barberName ?? "Sem preferência"}`,
    `Data: ${formatDateShort(req.date)}`,
    `Horário: ${describeTime(req)}`,
    "",
    "Aguardo a confirmação. Obrigado!",
  ].join("\n");
}

export function buildBookingLink(req: BookingRequest): string {
  return whatsappLink(buildBookingMessage(req));
}

/** Máscara de telefone brasileiro: (79) 99999-9999 */
export function maskPhone(value: string): string {
  const d = value.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidPhone(value: string): boolean {
  const d = value.replace(/\D/g, "");
  return d.length === 10 || d.length === 11;
}
