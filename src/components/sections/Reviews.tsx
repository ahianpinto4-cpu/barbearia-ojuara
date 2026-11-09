import { ArrowUpRight, MessageSquareQuote, Quote } from "lucide-react";
import { reviews, site } from "@/config/site";
import { googleReviewsLink } from "@/lib/links";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { CountUp } from "@/components/ui/CountUp";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Stars } from "@/components/ui/Stars";

export function Reviews() {
  const showSlots = reviews.length === 0 && site.showPlaceholderHints;

  return (
    <section id="avaliacoes" aria-labelledby="avaliacoes-titulo" className="grain relative overflow-hidden bg-ink-2 py-24 sm:py-32 lg:py-40">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[30rem] w-[60rem] -translate-x-1/2 rounded-full bg-gold/[0.06] blur-3xl" />

      <div className="container-luxe relative">
        <SectionHeading
          index="04"
          eyebrow="Avaliações"
          align="center"
          id="avaliacoes-titulo"
          title={
            <>
              Quem conhece, <span className="text-gold italic">recomenda.</span>
            </>
          }
        />

        <Reveal delay={0.15} className="mx-auto mt-14 max-w-2xl text-center">
          <div className="relative inline-flex flex-col items-center border-y border-gold/25 px-10 py-10 sm:px-16">
            <p className="font-display text-[6.5rem] leading-none font-medium text-ice sm:text-[8.5rem]">
              <CountUp to={site.rating} decimals={1} duration={2} />
            </p>
            <Stars value={site.rating} size={26} className="mt-4" />
            <p className="mt-4 text-[0.7rem] font-semibold tracking-[0.3em] text-mute uppercase">Avaliação no Google Maps</p>
          </div>
          <p className="mx-auto mt-10 max-w-xl font-display text-xl leading-relaxed text-ice/85 italic sm:text-2xl">
            “Uma avaliação que reflete a confiança e a satisfação dos clientes da {site.name}.”
          </p>
          <ButtonLink href={googleReviewsLink} external variant="outline" className="mt-10">
            Ver avaliações no Google <ArrowUpRight className="size-4" />
          </ButtonLink>
        </Reveal>

        {reviews.length > 0 && (
          <ul className="mt-20 grid gap-5 md:grid-cols-3">
            {reviews.map((r, i) => (
              <Reveal as="li" key={`${r.author}-${i}`} delay={i * 0.08}>
                <figure className="flex h-full flex-col rounded-sm border border-line bg-ink p-7 transition-colors duration-500 hover:border-gold/40">
                  <Quote className="size-7 text-gold/60" strokeWidth={1} aria-hidden />
                  <Stars value={r.rating} size={15} className="mt-5" />
                  <blockquote className="mt-4 flex-1 leading-relaxed text-ice/85">“{r.text}”</blockquote>
                  <figcaption className="mt-6 border-t border-line pt-5 text-sm">
                    <span className="font-semibold text-ice">{r.author}</span>
                    {r.when && <span className="text-mute"> · {r.when}</span>}
                    <span className="block text-xs text-mute-2">Avaliação publicada no Google</span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </ul>
        )}

        {showSlots && (
          <ul className="mt-20 grid gap-5 md:grid-cols-3" aria-label="Espaços reservados para avaliações reais">
            {[0, 1, 2].map((i) => (
              <Reveal as="li" key={i} delay={i * 0.08}>
                <div className="flex h-full min-h-56 flex-col items-center justify-center rounded-sm border border-dashed border-gold/25 bg-ink/50 p-7 text-center">
                  <MessageSquareQuote className="size-8 text-gold/40" strokeWidth={1} aria-hidden />
                  <p className="mt-4 text-[0.62rem] font-semibold tracking-[0.22em] text-mute-2 uppercase">Espaço reservado</p>
                  <p className="mt-2 max-w-[15rem] text-sm text-mute">
                    Avaliação real do Google a ser inserida em <code className="text-gold/80">src/config/site.ts</code>
                  </p>
                </div>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
