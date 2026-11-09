import { site } from "@/config/site";

/**
 * URL pública do site. Defina NEXT_PUBLIC_SITE_URL ao publicar
 * (ex.: https://www.seudominio.com.br). Na Vercel, o domínio de produção é
 * detectado automaticamente.
 */
export const siteUrl = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");

export const seo = {
  title: "Barbearia Ojuara | Estilo, Qualidade e Tradição em São Cristóvão - SE",
  description:
    "Conheça a Barbearia Ojuara, com mais de 5 anos de experiência e avaliação de 4,9 estrelas. Agende seu atendimento pelo WhatsApp em São Cristóvão - SE.",
};

/** Dados estruturados (schema.org) — somente informações verificadas. */
export function localBusinessJsonLd() {
  const sameAs = [site.links.instagram, site.links.googleBusinessProfile].filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "BarberShop",
    "@id": `${siteUrl}/#barbearia`,
    name: site.name,
    description: site.description,
    url: siteUrl,
    image: `${siteUrl}/opengraph-image`,
    telephone: site.contact.phoneE164,
    address: {
      "@type": "PostalAddress",
      streetAddress: `${site.address.street} - ${site.address.neighborhood}`,
      addressLocality: site.address.city,
      addressRegion: site.address.state,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    hasMap: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address.full)}`,
    areaServed: { "@type": "City", name: `${site.address.city} - ${site.address.state}` },
    ...(sameAs.length ? { sameAs } : {}),
  };
}
