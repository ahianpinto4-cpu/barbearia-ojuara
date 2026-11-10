/* eslint-disable @next/next/no-img-element */
import { ArrowUpRight, Clock, Scissors } from "lucide-react";
import { site, type Service } from "@/config/site";
import { formatDuration, formatPrice, whatsappLink } from "@/lib/links";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";

export function Services({ services }: { services: Service[] }) {
  return (
    <section id="servicos" aria-labelledby="servicos-titulo" className="grain relative bg-ink-2 py-24 sm:py-32 lg:py-40">
      <div className="container-luxe">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            index="02"
            eyebrow="Serviços"
            id="servicos-titulo"
            title={
              <>
                O cuidado com seu visual <span className="text-gold italic">começa aqui.</span>
              </>
            }
            subtitle="Escolha o serviço ideal e reserve seu horário em poucos segundos pelo WhatsApp."
          />
        </div>

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:gap-6">
          {services.map((s, i) => {
            const duration = formatDuration(s.durationMinutes);
            return (
              <Reveal as="li" key={s.id} delay={i * 0.08}>
                <article className="group relative flex h-full flex-col overflow-hidden rounded-sm border border-line bg-ink transition-all duration-700 ease-[cubic-bezier(.22,1,.36,1)] hover:-translate-y-1.5 hover:border-gold/40 hover:shadow-[0_30px_60px_-30px_rgba(201,164,76,.35)]">
                  {/* Foto do serviço */}
                  <div className="relative aspect-[16/11] overflow-hidden">
                    {s.image ? (
                      <img
                        src={s.image}
                        alt={`${s.name} na ${site.name}`}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-105"
                      />
                    ) : (
                      <div className="placeholder-pattern flex h-full w-full flex-col items-center justify-center gap-3 transition-transform duration-[1.2s] group-hover:scale-105">
                        <Scissors className="size-9 text-gold/50 transition-transform duration-700 group-hover:-rotate-12" strokeWidth={1} aria-hidden />
                        {site.showPlaceholderHints && (
                          <span className="text-[0.62rem] font-semibold tracking-[0.25em] text-mute-2 uppercase">Espaço para foto do serviço</span>
                        )}
                      </div>
                    )}
                    <span className="absolute top-4 left-4 font-display text-sm text-gold/80 tabular-nums">0{i + 1}</span>
                    {s.provisional && site.showPlaceholderHints && (
                      <span className="absolute top-3.5 right-3.5 rounded-sm border border-dashed border-gold/40 bg-ink/80 px-2 py-1 text-[0.6rem] font-semibold tracking-[0.15em] text-gold/90 uppercase backdrop-blur">
                        Conteúdo a confirmar
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-6 sm:p-7">
                    <h3 className="font-display text-2xl text-ice sm:text-[1.7rem]">{s.name}</h3>
                    <p className="mt-3 flex-1 leading-relaxed text-mute">{s.description}</p>

                    <div className="mt-6 flex items-end justify-between gap-4 border-t border-line pt-5">
                      <div>
                        <p className="text-[0.62rem] font-semibold tracking-[0.22em] text-mute-2 uppercase">Investimento</p>
                        <p className={`mt-1 font-semibold ${s.price === null ? "text-sm text-ice/80" : "font-display text-2xl text-gold"}`}>
                          {formatPrice(s.price)}
                        </p>
                      </div>
                      {duration && (
                        <p className="inline-flex items-center gap-1.5 text-sm text-mute">
                          <Clock className="size-4 text-gold/80" aria-hidden /> {duration}
                        </p>
                      )}
                    </div>

                    <a
                      href={whatsappLink(site.messages.service(s.name))}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Agendar ${s.name} pelo WhatsApp`}
                      className="group/btn mt-6 inline-flex min-h-12 items-center justify-between gap-2 border border-line px-5 text-[0.7rem] font-bold tracking-[0.18em] text-ice uppercase transition-all duration-500 hover:border-gold hover:bg-gold hover:text-ink"
                    >
                      Reservar meu horário
                      <ArrowUpRight className="size-4 transition-transform duration-500 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
                    </a>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </ul>

        <Reveal className="mt-12 flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-center">
          <p className="text-mute">Não sabe qual escolher? Nossa equipe te ajuda pelo WhatsApp.</p>
          <a
            href={whatsappLink("Olá! Vim pelo site e gostaria de ajuda para escolher o melhor serviço para mim.")}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[0.7rem] font-bold tracking-[0.18em] text-gold uppercase hover:text-gold-soft"
          >
            Falar com a Ojuara <ArrowUpRight className="size-4" />
          </a>
        </Reveal>
      </div>
    </section>
  );
}
