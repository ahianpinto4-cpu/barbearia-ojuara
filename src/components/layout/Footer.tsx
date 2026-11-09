import { ArrowUpRight, MapPin, Phone } from "lucide-react";
import { InstagramIcon } from "@/components/ui/InstagramIcon";
import { navLinks, site } from "@/config/site";
import { directionsLink, mapsSearchLink, phoneHref, whatsappLink } from "@/lib/links";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { CurrentYear } from "./CurrentYear";

/** Ano de referência da última publicação (o componente atualiza no navegador). */
const BUILD_YEAR = 2026;

export function Footer() {
  return (
    <footer className="grain relative border-t border-line bg-ink pt-20 pb-10" aria-labelledby="rodape-titulo">
      <h2 id="rodape-titulo" className="sr-only">
        Rodapé
      </h2>
      <div className="container-luxe">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Logo variant="full" className="h-auto w-full max-w-[22rem]" />
            <p className="mt-6 max-w-sm leading-relaxed text-mute">
              Há mais de {site.yearsInBusiness} anos cuidando do estilo de cada cliente com dedicação, profissionalismo e
              atenção aos detalhes. Avaliação de {site.rating.toLocaleString("pt-BR")} estrelas no Google.
            </p>
            <ButtonLink href={whatsappLink()} external size="md" className="mt-8">
              <WhatsAppIcon className="size-4" />
              Agendar pelo WhatsApp
            </ButtonLink>
          </div>

          <nav aria-label="Rodapé" className="lg:col-span-2">
            <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-gold uppercase">Navegação</p>
            <ul className="mt-6 space-y-3">
              <li>
                <a href="#inicio" className="text-mute transition-colors hover:text-ice">
                  Início
                </a>
              </li>
              {navLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="text-mute transition-colors hover:text-ice">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-5">
            <p className="text-[0.68rem] font-semibold tracking-[0.28em] text-gold uppercase">Contato</p>
            <ul className="mt-6 space-y-5">
              <li>
                <a href={phoneHref} className="group flex items-start gap-3 text-ice transition-colors hover:text-gold">
                  <Phone className="mt-0.5 size-5 shrink-0 text-gold" strokeWidth={1.5} />
                  <span>
                    {site.contact.phoneDisplay}
                    <span className="block text-sm text-mute">Telefone e WhatsApp</span>
                  </span>
                </a>
              </li>
              <li>
                <a href={mapsSearchLink} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 text-ice transition-colors hover:text-gold">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-gold" strokeWidth={1.5} />
                  <span>
                    {site.address.street} — {site.address.neighborhood}
                    <span className="block text-sm text-mute">
                      {site.address.city} - {site.address.state}, {site.address.postalCode}
                    </span>
                  </span>
                </a>
              </li>
              <li className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
                <a href={directionsLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-wide text-gold hover:text-gold-soft">
                  Como chegar <ArrowUpRight className="size-4" />
                </a>
                {site.links.instagram ? (
                  <a href={site.links.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-wide text-gold hover:text-gold-soft">
                    <InstagramIcon className="size-4" /> {site.links.instagramHandle}
                  </a>
                ) : (
                  site.showPlaceholderHints && (
                    <span className="inline-flex items-center gap-1.5 rounded-sm border border-dashed border-gold/30 px-2 py-1 text-xs text-mute-2">
                      <InstagramIcon className="size-3.5" /> Instagram: inserir perfil oficial
                    </span>
                  )
                )}
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-4 border-t border-line pt-8 text-sm text-mute-2 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <CurrentYear fallback={BUILD_YEAR} /> {site.name}. Todos os direitos reservados.
          </p>
          <a href="#inicio" className="inline-flex items-center gap-2 transition-colors hover:text-gold">
            Voltar ao topo <ArrowUpRight className="size-4 -rotate-45" />
          </a>
        </div>
      </div>
    </footer>
  );
}
