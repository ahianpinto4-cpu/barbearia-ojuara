import { site } from "@/config/site";

/** Gera um link wa.me com a mensagem devidamente codificada. */
export function whatsappLink(message: string = site.messages.general): string {
  return `https://wa.me/${site.contact.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export const phoneHref = `tel:+${site.contact.whatsappNumber}`;

const mapsQuery = encodeURIComponent(`${site.name}, ${site.address.full}`);
const addressQuery = encodeURIComponent(site.address.full);

/** Abre o Google Maps com rota até a barbearia (a partir da localização do usuário). */
export const directionsLink = `https://www.google.com/maps/dir/?api=1&destination=${addressQuery}`;

/** Localização no Google Maps (busca pelo endereço completo). */
export const mapsSearchLink = `https://www.google.com/maps/search/?api=1&query=${addressQuery}`;

/** Mapa incorporado (sem chave de API), centralizado no endereço completo. */
export const mapsEmbedLink = `https://maps.google.com/maps?q=${addressQuery}&hl=pt-BR&z=17&output=embed`;

/** Perfil oficial do Google (se informado) ou busca pelo nome + endereço. */
export const googleReviewsLink =
  site.links.googleBusinessProfile ?? `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

export function formatPrice(price: number | null): string {
  if (price === null) return "Valor sob consulta";
  return price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDuration(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** Imagem remota otimizada (Unsplash aceita parâmetros de largura e formato automático). */
export function remoteSrcSet(src: string, widths: number[] = [640, 960, 1280, 1920]) {
  if (!src.startsWith("https://images.unsplash.com")) return undefined;
  return widths.map((w) => `${src}?auto=format&fit=crop&q=70&w=${w} ${w}w`).join(", ");
}

export function remoteSrc(src: string, width = 1280) {
  if (!src.startsWith("https://images.unsplash.com")) return src;
  return `${src}?auto=format&fit=crop&q=70&w=${width}`;
}
