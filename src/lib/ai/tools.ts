import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { site } from "@/config/site";
import {
  BookingError,
  cancelAppointment,
  createAppointment,
  getAvailability,
  getBusinessHours,
  listBarbers,
  listCustomerUpcoming,
  listServices,
  rescheduleAppointment,
  setCustomerName,
  type AppointmentView,
} from "@/lib/server/booking";
import { formatDatePt, formatDateShortPt, formatPriceBRL, WEEKDAYS_PT } from "@/lib/time";

/**
 * Ferramentas do assistente. A IA apenas SOLICITA operações; cada uma é
 * validada aqui (Zod + regras de negócio) antes de tocar no banco.
 * O cliente só enxerga/altera os próprios agendamentos (customerId do contexto).
 */
export type ToolContext = {
  customerId: string;
  customerName: string | null;
  isTest: boolean;
  /** Preenchido quando a IA pede atendimento humano. */
  onHandoff: (reason: string) => Promise<void>;
  /** Agendamentos criados/alterados nesta rodada (para mensagens de confirmação). */
  bookings: AppointmentView[];
};

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use AAAA-MM-DD");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const TOOL_DEFINITIONS: Anthropic.Beta.BetaTool[] = [
  {
    name: "consultar_informacoes_barbearia",
    description: "Retorna endereço, telefone, avaliação, tempo de mercado e horário de funcionamento cadastrado da Barbearia Ojuara.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "consultar_servicos",
    description: "Lista os serviços ativos com id, descrição, preço e duração. Use para identificar o serviço desejado.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "consultar_precos",
    description: "Consulta o preço de um serviço pelo nome (ou de todos, se o nome for omitido).",
    input_schema: {
      type: "object",
      properties: { servico: { type: "string", description: "Nome ou parte do nome do serviço" } },
      additionalProperties: false,
    },
  },
  {
    name: "consultar_barbeiros",
    description: "Lista os barbeiros ativos (id, nome e dias da semana em que atendem).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "consultar_disponibilidade",
    description:
      "Consulta os horários REALMENTE livres para um serviço em uma data, por barbeiro. Considera funcionamento, jornada, pausas, bloqueios, agendamentos e atendimentos presenciais.",
    input_schema: {
      type: "object",
      properties: {
        servico_id: { type: "string", description: "id do serviço (de consultar_servicos)" },
        data: { type: "string", description: "Data no formato AAAA-MM-DD" },
        barbeiro_id: { type: "string", description: "Opcional: id do barbeiro preferido" },
        a_partir_de: { type: "string", description: "Opcional: só horários a partir de HH:MM" },
        ate: { type: "string", description: "Opcional: só horários com início até HH:MM" },
      },
      required: ["servico_id", "data"],
      additionalProperties: false,
    },
  },
  {
    name: "criar_agendamento",
    description:
      "Grava o agendamento. Só use depois de mostrar o resumo e o cliente confirmar explicitamente. Revalida a disponibilidade de forma transacional.",
    input_schema: {
      type: "object",
      properties: {
        servico_id: { type: "string" },
        data: { type: "string", description: "AAAA-MM-DD" },
        horario: { type: "string", description: "HH:MM" },
        barbeiro_id: { type: "string", description: "Opcional; omita se o cliente não tem preferência" },
        nome_cliente: { type: "string", description: "Nome informado pelo cliente" },
        cliente_confirmou: { type: "boolean", description: "true somente após o cliente confirmar o resumo" },
      },
      required: ["servico_id", "data", "horario", "nome_cliente", "cliente_confirmou"],
      additionalProperties: false,
    },
  },
  {
    name: "consultar_agendamento",
    description: "Lista os próximos agendamentos ativos do cliente desta conversa.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "cancelar_agendamento",
    description: "Cancela um agendamento do próprio cliente, após confirmação explícita.",
    input_schema: {
      type: "object",
      properties: {
        agendamento_id: { type: "string" },
        motivo: { type: "string" },
        cliente_confirmou: { type: "boolean" },
      },
      required: ["agendamento_id", "cliente_confirmou"],
      additionalProperties: false,
    },
  },
  {
    name: "reagendar_agendamento",
    description: "Move um agendamento do cliente para nova data/horário (revalidando disponibilidade), após confirmação.",
    input_schema: {
      type: "object",
      properties: {
        agendamento_id: { type: "string" },
        nova_data: { type: "string", description: "AAAA-MM-DD" },
        novo_horario: { type: "string", description: "HH:MM" },
        barbeiro_id: { type: "string", description: "Opcional" },
        cliente_confirmou: { type: "boolean" },
      },
      required: ["agendamento_id", "nova_data", "novo_horario", "cliente_confirmou"],
      additionalProperties: false,
    },
  },
  {
    name: "solicitar_atendimento_humano",
    description:
      "Transfere a conversa para a equipe (pausa as respostas automáticas e avisa o responsável). Use quando o cliente pedir uma pessoa, reclamar, ou quando não for possível resolver.",
    input_schema: {
      type: "object",
      properties: { motivo: { type: "string", description: "Resumo curto do motivo" } },
      required: ["motivo"],
      additionalProperties: false,
    },
  },
];

const schemas = {
  consultar_informacoes_barbearia: z.object({}).strict(),
  consultar_servicos: z.object({}).strict(),
  consultar_precos: z.object({ servico: z.string().max(100).optional() }).strict(),
  consultar_barbeiros: z.object({}).strict(),
  consultar_disponibilidade: z
    .object({ servico_id: uuid, data: isoDate, barbeiro_id: uuid.optional(), a_partir_de: hhmm.optional(), ate: hhmm.optional() })
    .strict(),
  criar_agendamento: z
    .object({
      servico_id: uuid,
      data: isoDate,
      horario: hhmm,
      barbeiro_id: uuid.optional(),
      nome_cliente: z.string().trim().min(2).max(80),
      cliente_confirmou: z.boolean(),
    })
    .strict(),
  consultar_agendamento: z.object({}).strict(),
  cancelar_agendamento: z
    .object({ agendamento_id: uuid, motivo: z.string().max(300).optional(), cliente_confirmou: z.boolean() })
    .strict(),
  reagendar_agendamento: z
    .object({ agendamento_id: uuid, nova_data: isoDate, novo_horario: hhmm, barbeiro_id: uuid.optional(), cliente_confirmou: z.boolean() })
    .strict(),
  solicitar_atendimento_humano: z.object({ motivo: z.string().min(2).max(500) }).strict(),
} as const;

export type ToolName = keyof typeof schemas;

function describeAppointment(a: AppointmentView) {
  return {
    agendamento_id: a.id,
    servico: a.service_name,
    barbeiro: a.barber_name,
    data: a.appointment_date,
    data_por_extenso: formatDatePt(a.appointment_date),
    horario: a.start_time,
    termino_previsto: a.end_time,
    valor: formatPriceBRL(a.price),
    status: a.status,
  };
}

/** Mensagem de confirmação final (formato definido pela barbearia). */
export function confirmationMessage(a: AppointmentView): string {
  return [
    "Seu horário foi confirmado com sucesso! 💈",
    "",
    `📅 Data: ${formatDateShortPt(a.appointment_date)} (${formatDatePt(a.appointment_date).split(",")[0]})`,
    `🕒 Horário: ${a.start_time}`,
    `✂️ Serviço: ${a.service_name}`,
    `👤 Profissional: ${a.barber_name}`,
    `💰 Valor: ${formatPriceBRL(a.price)}`,
    "",
    "A Barbearia Ojuara agradece sua preferência!",
    "Estamos esperando por você.",
  ].join("\n");
}

function needConfirmation() {
  return {
    erro: "CONFIRMACAO_PENDENTE",
    instrucao: "Apresente o resumo ao cliente e pergunte se ele confirma. Só chame novamente com cliente_confirmou=true após um sim claro.",
  };
}

function bookingErrorResult(err: BookingError) {
  return { erro: err.code, mensagem: err.message, ...(err.details ?? {}) };
}

export async function executeTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<{ result: unknown; isError: boolean }> {
  if (!(name in schemas)) return { result: { erro: "FERRAMENTA_DESCONHECIDA" }, isError: true };
  const parsed = schemas[name as ToolName].safeParse(rawInput ?? {});
  if (!parsed.success) {
    return { result: { erro: "PARAMETROS_INVALIDOS", detalhes: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, isError: true };
  }
  const input = parsed.data as Record<string, unknown>;
  try {
    switch (name as ToolName) {
      case "consultar_informacoes_barbearia": {
        const hours = await getBusinessHours();
        const active = hours.filter((h) => h.active);
        return {
          isError: false,
          result: {
            nome: site.name,
            endereco: site.address.full,
            telefone_whatsapp: site.contact.phoneDisplay,
            avaliacao_google: `${site.rating.toLocaleString("pt-BR")} estrelas`,
            tempo_de_mercado: `mais de ${site.yearsInBusiness} anos`,
            instagram: site.links.instagramHandle,
            como_chegar: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(site.address.full)}`,
            atende_por_ordem_de_chegada: true,
            horario_de_funcionamento: active.length
              ? active.map((h) => `${WEEKDAYS_PT[h.day_of_week]}: ${h.opening_time} às ${h.closing_time}`)
              : "Horário de funcionamento ainda não cadastrado — não informe horários; ofereça falar com a equipe.",
          },
        };
      }
      case "consultar_servicos":
      case "consultar_precos": {
        const term = typeof input.servico === "string" ? input.servico.toLowerCase() : "";
        const services = (await listServices()).filter((s) => !term || s.name.toLowerCase().includes(term));
        return {
          isError: false,
          result: services.length
            ? services.map((s) => ({
                servico_id: s.id,
                nome: s.name,
                descricao: s.description,
                preco: formatPriceBRL(s.price),
                duracao: s.duration_minutes ? `${s.duration_minutes} min` : "não informada",
                agendavel_pelo_whatsapp: Boolean(s.duration_minutes),
              }))
            : { aviso: "Nenhum serviço ativo encontrado. Não invente serviços; ofereça falar com a equipe." },
        };
      }
      case "consultar_barbeiros": {
        const barbers = await listBarbers();
        return {
          isError: false,
          result: barbers.length
            ? barbers.map((b) => ({
                barbeiro_id: b.id,
                nome: b.name,
                dias_de_atendimento: Object.entries(b.working_hours ?? {})
                  .filter(([, v]) => v?.length)
                  .map(([d]) => WEEKDAYS_PT[Number(d)]),
              }))
            : { aviso: "Nenhum barbeiro cadastrado. Não é possível agendar automaticamente; ofereça falar com a equipe." },
        };
      }
      case "consultar_disponibilidade": {
        const r = await getAvailability({
          serviceId: input.servico_id as string,
          date: input.data as string,
          barberId: (input.barbeiro_id as string) ?? null,
        });
        if (!r.ok) return { isError: false, result: { disponivel: false, motivo: r.message, codigo: r.code } };
        const from = (input.a_partir_de as string) ?? "00:00";
        const to = (input.ate as string) ?? "23:59";
        return {
          isError: false,
          result: {
            data: r.date,
            data_por_extenso: formatDatePt(r.date),
            servico: r.service.name,
            duracao_min: r.service.duration_minutes,
            valor: formatPriceBRL(r.service.price),
            barbeiros: r.barbers.map((b) => ({
              barbeiro_id: b.barber_id,
              nome: b.barber_name,
              horarios_livres: b.slots.filter((s) => s >= from && s <= to),
            })),
          },
        };
      }
      case "criar_agendamento": {
        if (!input.cliente_confirmou) return { isError: false, result: needConfirmation() };
        const name = String(input.nome_cliente);
        await setCustomerName(ctx.customerId, name);
        ctx.customerName = name;
        const appt = await createAppointment({
          customerId: ctx.customerId,
          customerName: name,
          serviceId: input.servico_id as string,
          barberId: (input.barbeiro_id as string) ?? null,
          date: input.data as string,
          time: input.horario as string,
          source: "whatsapp",
          isTest: ctx.isTest,
        });
        ctx.bookings.push(appt);
        return {
          isError: false,
          result: { sucesso: true, agendamento: describeAppointment(appt), mensagem_confirmacao: confirmationMessage(appt) },
        };
      }
      case "consultar_agendamento": {
        const list = await listCustomerUpcoming(ctx.customerId);
        return { isError: false, result: list.length ? list.map(describeAppointment) : { aviso: "Nenhum agendamento ativo." } };
      }
      case "cancelar_agendamento": {
        if (!input.cliente_confirmou) return { isError: false, result: needConfirmation() };
        const appt = await cancelAppointment(input.agendamento_id as string, {
          customerId: ctx.customerId,
          reason: (input.motivo as string) ?? null,
          by: "customer",
        });
        return { isError: false, result: { sucesso: true, cancelado: describeAppointment(appt) } };
      }
      case "reagendar_agendamento": {
        if (!input.cliente_confirmou) return { isError: false, result: needConfirmation() };
        const appt = await rescheduleAppointment(input.agendamento_id as string, {
          date: input.nova_data as string,
          time: input.novo_horario as string,
          barberId: (input.barbeiro_id as string) ?? null,
          customerId: ctx.customerId,
        });
        ctx.bookings.push(appt);
        return {
          isError: false,
          result: { sucesso: true, agendamento: describeAppointment(appt), mensagem_confirmacao: confirmationMessage(appt) },
        };
      }
      case "solicitar_atendimento_humano": {
        await ctx.onHandoff(String(input.motivo));
        return {
          isError: false,
          result: { sucesso: true, instrucao: "Avise o cliente, em uma frase, que a equipe foi acionada e responderá por aqui." },
        };
      }
    }
  } catch (err) {
    if (err instanceof BookingError) return { isError: false, result: bookingErrorResult(err) };
    throw err;
  }
}
