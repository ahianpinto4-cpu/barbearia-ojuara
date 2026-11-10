"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { ArrowDown, BadgeCheck, Star } from "lucide-react";
import { useRef } from "react";
import { ambientImages, site } from "@/config/site";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { useIntroDone } from "@/components/animations/useIntroDone";
import { whatsappLink } from "@/lib/links";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { SafeImage } from "@/components/ui/SafeImage";
import { CountUp } from "@/components/ui/CountUp";

const ease = [0.22, 1, 0.36, 1] as const;

function Line({ children, delay, reduce }: { children: React.ReactNode; delay: number; reduce: boolean | null }) {
  return (
    <span className="block overflow-hidden pb-[0.08em]">
      <motion.span
        className="block"
        initial={reduce ? { opacity: 0 } : { y: "105%" }}
        animate={reduce ? { opacity: 1 } : { y: "0%" }}
        transition={{ duration: 1.1, delay, ease }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** Composição decorativa exibida caso a fotografia não carregue. */
function HeroArt() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden bg-ink">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_40%,rgba(201,164,76,.16),transparent_55%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_90%_90%,rgba(223,52,12,.10),transparent_45%)]" />
      <svg viewBox="0 0 400 400" className="absolute top-1/2 right-[-30%] h-[120%] -translate-y-1/2 text-gold opacity-25 sm:right-[-10%] lg:right-[2%] lg:h-[95%] lg:opacity-40">
        <circle cx="200" cy="200" r="190" fill="none" stroke="currentColor" strokeWidth="0.6" />
        <circle cx="200" cy="200" r="160" fill="none" stroke="currentColor" strokeWidth="0.3" />
        <path d="M200 10v40M200 350v40" stroke="currentColor" strokeWidth="0.8" />
      </svg>
    </div>
  );
}

export function Hero() {
  const introDone = useIntroDone();
  return <HeroInner key={introDone ? "ready" : "waiting"} />;
}

function HeroInner() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", reduce ? "0%" : "18%"]);
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.04, reduce ? 1.04 : 1.14]);

  const fade = (delay: number) => ({
    initial: reduce ? { opacity: 0 } : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease },
  });

  return (
    <section
      ref={ref}
      id="inicio"
      aria-labelledby="hero-titulo"
      className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-ink"
    >
      {/* Fotografia */}
      <motion.div className="absolute inset-0 -z-20" style={{ y: imgY, scale: imgScale }}>
        <motion.div
          className="relative h-full w-full"
          initial={{ opacity: 0, scale: reduce ? 1 : 1.08 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.8, ease }}
        >
          <SafeImage
            src={ambientImages.hero.src}
            alt={ambientImages.hero.alt}
            priority
            width={1920}
            fallback={<HeroArt />}
            sizes="100vw"
            className="absolute inset-0 h-full w-full object-cover object-[65%_center] grayscale-[35%]"
          />
        </motion.div>
      </motion.div>

      {/* Camadas de contraste */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-ink via-ink/75 to-ink/40 lg:bg-gradient-to-r lg:from-ink lg:via-ink/80 lg:to-ink/10" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 -z-10 h-48 bg-gradient-to-t from-ink to-transparent" />
      <div aria-hidden className="grain absolute inset-0 -z-10" />

      {/* Linhas finas decorativas */}
      <motion.span
        aria-hidden
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ duration: 1.6, delay: 0.4, ease }}
        className="absolute top-0 left-5 hidden h-full w-px origin-top bg-gradient-to-b from-transparent via-gold/25 to-transparent sm:left-8 lg:left-12 lg:block"
      />

      <div className="container-luxe flex flex-1 flex-col justify-end pt-28 pb-8 sm:pb-14 lg:justify-center lg:pt-36 lg:pb-12">
        <div className="max-w-4xl lg:pl-10">
          <motion.p {...fade(0.15)} className="eyebrow max-w-[19rem] leading-relaxed sm:max-w-none">
            Tradição, estilo e excelência há mais de {site.yearsInBusiness} anos
          </motion.p>

          <h1
            id="hero-titulo"
            className="mt-5 font-display text-[2.3rem] leading-[1.04] font-medium tracking-[-0.015em] text-ice min-[400px]:text-[2.45rem] sm:mt-6 sm:text-6xl lg:text-[4.6rem] xl:text-[5.1rem]"
          >
            <Line delay={0.25} reduce={reduce}>
              Seu estilo merece
            </Line>
            <Line delay={0.37} reduce={reduce}>
              mais do que um corte.
            </Line>
            <Line delay={0.49} reduce={reduce}>
              <span className="text-mute">Merece </span>
              <em className="font-medium text-gold italic">Ojuara.</em>
            </Line>
          </h1>

          <motion.p {...fade(0.75)} className="mt-5 max-w-xl text-[0.95rem] leading-relaxed text-ice/75 sm:mt-7 sm:text-lg">
            Há mais de {site.yearsInBusiness} anos transformando cortes em identidade. Venha viver uma experiência de cuidado,
            estilo e profissionalismo.
          </motion.p>

          <motion.div {...fade(0.9)} className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:gap-4">
            <ButtonLink href={whatsappLink()} external className="w-full sm:w-auto">
              <WhatsAppIcon className="size-5" />
              Agendar pelo WhatsApp
            </ButtonLink>
            <ButtonLink href="#servicos" variant="outline" className="w-full sm:w-auto">
              Quero conhecer os serviços
            </ButtonLink>
          </motion.div>
          <motion.p {...fade(1)} className="mt-4 text-xs text-mute sm:text-sm">
            Converse, veja os horários e confirme pelo WhatsApp — sem precisar voltar ao site.
          </motion.p>
        </div>

        {/* Indicadores de credibilidade */}
        <motion.ul
          {...fade(1.1)}
          aria-label="Destaques da Barbearia Ojuara"
          className="mt-9 grid grid-cols-3 border-t border-ice/10 pt-5 sm:mt-12 sm:pt-6 lg:mt-16 lg:ml-10 lg:max-w-3xl"
        >
          <li className="pr-3">
            <p className="font-display text-3xl text-ice sm:text-4xl">
              <CountUp to={site.yearsInBusiness} prefix="+" />
            </p>
            <p className="mt-1 text-[0.7rem] leading-snug tracking-wide text-mute sm:text-sm">anos de experiência</p>
          </li>
          <li className="border-l border-ice/10 px-3 sm:px-6">
            <p className="flex items-center gap-1.5 font-display text-3xl text-ice sm:text-4xl">
              <CountUp to={site.rating} decimals={1} />
              <Star className="size-4 text-gold sm:size-5" fill="currentColor" aria-hidden />
            </p>
            <p className="mt-1 text-[0.7rem] leading-snug tracking-wide text-mute sm:text-sm">estrelas no Google Maps</p>
          </li>
          <li className="border-l border-ice/10 pl-3 sm:pl-6">
            <p className="font-display text-3xl text-gold sm:text-4xl">
              <BadgeCheck className="size-8 sm:size-9" strokeWidth={1.25} aria-hidden />
            </p>
            <p className="mt-1 text-[0.7rem] leading-snug tracking-wide text-mute sm:text-sm">atendimento profissional</p>
          </li>
        </motion.ul>
      </div>

      <motion.a
        href="#sobre"
        aria-label="Rolar para a próxima seção"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6, duration: 1 }}
        className="absolute right-5 bottom-10 hidden flex-col items-center gap-3 text-[0.62rem] font-semibold tracking-[0.3em] text-mute uppercase transition-colors hover:text-gold sm:right-8 lg:right-12 lg:flex"
      >
        <span className="[writing-mode:vertical-rl]">Role</span>
        <motion.span animate={reduce ? {} : { y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}>
          <ArrowDown className="size-4" />
        </motion.span>
      </motion.a>
    </section>
  );
}
