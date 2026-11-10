import { services as fallbackServices, type Service } from "@/config/site";
import { isDatabaseConfigured } from "./db";
import { listServices } from "./booking";

/**
 * Serviços exibidos no site: vêm do painel (banco) quando houver serviços
 * ativos; caso contrário, usa a lista provisória de src/config/site.ts.
 */
export async function getPublicServices(): Promise<{ services: Service[]; fromDatabase: boolean }> {
  if (!isDatabaseConfigured()) return { services: fallbackServices, fromDatabase: false };
  try {
    const rows = await listServices();
    if (rows.length === 0) return { services: fallbackServices, fromDatabase: false };
    return {
      fromDatabase: true,
      services: rows.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description ?? "",
        price: r.price,
        durationMinutes: r.duration_minutes,
        image: null,
        provisional: false,
      })),
    };
  } catch (err) {
    console.error("[site] falha ao carregar serviços do banco; usando lista local", err);
    return { services: fallbackServices, fromDatabase: false };
  }
}
