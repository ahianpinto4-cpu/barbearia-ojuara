import { Armchair, Award, Gem, ScanEye, UserRoundCheck } from "lucide-react";
import { ambientImages, site } from "@/config/site";
import { Reveal } from "@/components/ui/Reveal";
import { SafeImage } from "@/components/ui/SafeImage";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { CountUp } from "@/components/ui/CountUp";
import { BookingTrigger } from "@/components/booking/BookingTrigger";

const differentials = [
  { icon: Award, title: `Mais de ${site.yearsInBusiness} anos de mercado`, text: "Uma trajetória construída atendimento após atendimento." },
  { icon: Gem, title: "Compromisso com a qualidade", text: "Técnica, cuidado e capricho em cada serviço." },
  { icon: ScanEye, title: "Atenção aos detalhes", text: "Do primeiro alinhamento ao acabamento final." },
  { icon: Armchair, title: "Ambiente de barbearia", text: "Um espaço para relaxar enquanto cuidamos de você." },
  { icon: UserRoundCheck, title: "Respeito ao seu estilo", text: "Ouvimos o que você quer e valorizamos sua personalidade." },
];

export function About() {
  return (
    <section id="sobre" aria-labelledby="sobre-titulo" className="relative overflow-hidden bg-ink py-24 sm:py-32 lg:py-40">
      <div className="container-luxe grid items-center gap-16 lg:grid-cols-12 lg:gap-12">
        {/* Composição fotográfica */}
        <div className="relative lg:col-span-6">
          <Reveal className="relative mr-10 sm:mr-24 lg:mr-16">
            <div className="relative aspect-[4/5] overflow-hidden rounded-sm bg-ink-2">
              <SafeImage
                src={ambientImages.about.src}
                alt={ambientImages.about.alt}
                sizes="(min-width: 1024px) 45vw, 90vw"
                className="absolute inset-0 h-full w-full object-cover grayscale-[30%] transition-transform duration-[1.6s] ease-[cubic-bezier(.22,1,.36,1)] hover:scale-105"
              />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/70 via-transparent to-transparent" />
            </div>
            <span aria-hidden className="absolute -top-4 -left-4 -z-0 h-full w-full border border-gold/30 sm:-top-6 sm:-left-6" />
          </Reveal>

          <Reveal delay={0.2} className="absolute right-0 bottom-[-2.5rem] w-[46%] sm:w-[40%] lg:bottom-[-3rem]">
            <div className="relative aspect-square overflow-hidden rounded-sm border-4 border-ink bg-ink-2 shadow-2xl">
              <SafeImage
                src={ambientImages.aboutDetail.src}
                alt={ambientImages.aboutDetail.alt}
                sizes="(min-width: 1024px) 20vw, 45vw"
                width={800}
                className="absolute inset-0 h-full w-full object-cover grayscale-[30%]"
              />
            </div>
          </Reveal>

          <Reveal delay={0.35} className="absolute top-8 -left-2 sm:top-12 sm:-left-4">
            <div className="border border-gold/30 bg-ink/90 px-5 py-4 backdrop-blur-md sm:px-6 sm:py-5">
              <p className="font-display text-5xl leading-none text-gold sm:text-6xl">
                <CountUp to={site.yearsInBusiness} prefix="+" />
              </p>
              <p className="mt-2 text-[0.65rem] font-semibold tracking-[0.25em] text-ice uppercase">anos de história</p>
            </div>
          </Reveal>
        </div>

        {/* Texto */}
        <div className="pt-6 lg:col-span-6 lg:pt-0 lg:pl-8">
          <SectionHeading
            index="01"
            eyebrow="Sobre a Ojuara"
            id="sobre-titulo"
            title={
              <>
                Mais que uma barbearia. <span className="text-gold italic">Uma experiência de estilo.</span>
              </>
            }
          />
          <Reveal delay={0.2}>
            <p className="mt-7 text-base leading-relaxed text-mute sm:text-lg">
              Há mais de {site.yearsInBusiness} anos, a {site.name} constrói sua história com dedicação, profissionalismo e
              atenção a cada detalhe. Nosso compromisso é oferecer um atendimento de qualidade, valorizando o estilo e a
              personalidade de cada cliente.
            </p>
          </Reveal>

          <ul className="mt-10 grid gap-px overflow-hidden rounded-sm border border-line bg-line sm:grid-cols-2">
            {differentials.map(({ icon: Icon, title, text }, i) => (
              <Reveal
                as="li"
                key={title}
                delay={0.05 * i}
                className={`group bg-ink-2 p-5 transition-colors duration-500 hover:bg-ink-3 ${i === differentials.length - 1 ? "sm:col-span-2" : ""}`}
              >
                <Icon className="size-6 text-gold transition-transform duration-500 group-hover:-translate-y-0.5" strokeWidth={1.25} aria-hidden />
                <p className="mt-4 font-semibold text-ice">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-mute">{text}</p>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={0.1} className="mt-10">
            <BookingTrigger variant="outline">Quero conhecer a Ojuara</BookingTrigger>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
