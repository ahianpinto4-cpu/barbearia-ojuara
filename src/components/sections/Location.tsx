import { ArrowUpRight, Clock, MapPin, Navigation, Phone } from "lucide-react";
import { site } from "@/config/site";
import { directionsLink, mapsEmbedLink, mapsSearchLink, phoneHref, whatsappLink } from "@/lib/links";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { InstagramIcon } from "@/components/ui/InstagramIcon";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function Location() {
  return (
    <section id="localizacao" aria-labelledby="localizacao-titulo" className="relative bg-ink py-24 sm:py-32 lg:py-40">
      <div className="container-luxe">
        <SectionHeading
          index="06"
          eyebrow="Localização"
          id="localizacao-titulo"
          title={
            <>
              Estamos esperando <span className="text-gold italic">por você.</span>
            </>
          }
          subtitle={`No bairro ${site.address.neighborhood}, em ${site.address.city} - ${site.address.state}. Fácil de encontrar, difícil de esquecer.`}
        />

        <div className="mt-14 grid gap-5 lg:mt-20 lg:grid-cols-12 lg:gap-6">
          <Reveal className="relative overflow-hidden rounded-sm border border-line bg-ink-2 lg:col-span-8">
            <div className="relative aspect-[4/3.4] w-full sm:aspect-[16/10] lg:aspect-auto lg:h-full lg:min-h-[32rem]">
              <div className="placeholder-pattern absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-sm text-mute">
                <MapPin className="size-8 animate-pulse text-gold/60" strokeWidth={1.25} aria-hidden />
                <span>Carregando mapa…</span>
                <a href={mapsSearchLink} target="_blank" rel="noopener noreferrer" className="text-gold underline underline-offset-4">
                  Abrir no Google Maps
                </a>
              </div>
              <iframe
                title={`Mapa: localização da ${site.name} — ${site.address.full}`}
                src={mapsEmbedLink}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                className="absolute inset-0 h-full w-full border-0 [filter:grayscale(.85)_invert(.92)_contrast(.9)_hue-rotate(180deg)] transition-[filter] duration-700 hover:[filter:none]"
              />
            </div>
          </Reveal>

          <Reveal delay={0.12} className="lg:col-span-4">
            <address className="flex h-full flex-col rounded-sm border border-line bg-ink-2 p-7 not-italic sm:p-9">
              <span className="grid size-12 place-items-center rounded-full border border-gold/40 text-gold">
                <MapPin className="size-5" strokeWidth={1.5} aria-hidden />
              </span>
              <p className="mt-6 text-[0.65rem] font-semibold tracking-[0.25em] text-mute-2 uppercase">Endereço</p>
              <p className="mt-2 font-display text-2xl leading-snug text-ice">
                {site.address.street}
                <span className="block text-lg text-mute">
                  {site.address.neighborhood}, {site.address.city} - {site.address.state}
                </span>
                <span className="block text-base text-mute">CEP {site.address.postalCode}</span>
              </p>

              <ul className="mt-7 space-y-4 border-t border-line pt-7 text-sm">
                <li>
                  <a href={phoneHref} className="flex items-center gap-3 text-ice transition hover:text-gold">
                    <Phone className="size-4 text-gold" aria-hidden /> {site.contact.phoneDisplay}
                  </a>
                </li>
                {site.links.instagram && (
                  <li>
                    <a href={site.links.instagram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-ice transition hover:text-gold">
                      <InstagramIcon className="size-4 text-gold" /> {site.links.instagramHandle}
                    </a>
                  </li>
                )}
                <li className="flex items-start gap-3 text-mute">
                  <Clock className="mt-0.5 size-4 shrink-0 text-gold" aria-hidden />
                  {site.openingHoursText ?? (
                    <span>
                      Horários de atendimento:{" "}
                      <a href={whatsappLink("Olá! Gostaria de saber os horários de atendimento da Barbearia Ojuara.")} target="_blank" rel="noopener noreferrer" className="text-ice underline decoration-gold/50 underline-offset-4 hover:text-gold">
                        consulte pelo WhatsApp
                      </a>
                    </span>
                  )}
                </li>
              </ul>

              <div className="mt-auto flex flex-col gap-3 pt-9">
                <ButtonLink href={directionsLink} external className="w-full">
                  <Navigation className="size-4" /> Como chegar
                </ButtonLink>
                <ButtonLink href={mapsSearchLink} external variant="outline" size="md" className="w-full">
                  Abrir no Google Maps <ArrowUpRight className="size-4" />
                </ButtonLink>
              </div>
            </address>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
