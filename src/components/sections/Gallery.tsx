"use client";
/* eslint-disable @next/next/no-img-element */

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Camera, ChevronLeft, ChevronRight, Expand, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { gallery, site, type GalleryItem } from "@/config/site";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { BookingTrigger } from "@/components/booking/BookingTrigger";

const shapeClass: Record<GalleryItem["shape"], string> = {
  square: "aspect-square",
  tall: "row-span-2 aspect-[1/2] sm:aspect-auto",
  wide: "col-span-2 aspect-[2/1]",
};

function Placeholder({ index, large = false }: { index: number; large?: boolean }) {
  return (
    <div className="placeholder-pattern flex h-full w-full flex-col items-center justify-center gap-3 p-4 text-center">
      <Camera className={`${large ? "size-12" : "size-7 sm:size-8"} text-gold/45`} strokeWidth={1} aria-hidden />
      <span className={`font-display ${large ? "text-3xl" : "text-xl"} text-ice/70 tabular-nums`}>{String(index + 1).padStart(2, "0")}</span>
      {site.showPlaceholderHints && (
        <span className={`${large ? "text-xs" : "text-[0.58rem] sm:text-[0.62rem]"} max-w-[16rem] font-semibold tracking-[0.2em] text-mute-2 uppercase`}>
          Espaço para foto real de corte da Ojuara
        </span>
      )}
    </div>
  );
}

export function Gallery() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [dir, setDir] = useState(1);
  const reduce = useReducedMotion();
  const lastTrigger = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const total = gallery.length;
  const go = useCallback(
    (delta: number) => {
      setDir(delta);
      setOpenIndex((i) => (i === null ? i : (i + delta + total) % total));
    },
    [total],
  );
  const close = useCallback(() => {
    setOpenIndex(null);
    lastTrigger.current?.focus();
  }, []);

  useEffect(() => {
    if (openIndex === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [openIndex, go, close]);

  const current = openIndex !== null ? gallery[openIndex] : null;

  return (
    <section id="galeria" aria-labelledby="galeria-titulo" className="relative bg-ink py-24 sm:py-32 lg:py-40">
      <div className="container-luxe">
        <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            index="03"
            eyebrow="Galeria de cortes"
            id="galeria-titulo"
            title={
              <>
                O resultado <span className="text-gold italic">fala por si.</span>
              </>
            }
            subtitle="Confira alguns estilos e inspire-se para seu próximo visual."
          />
          <Reveal delay={0.2} className="hidden lg:block">
            <BookingTrigger variant="outline">Quero um visual assim</BookingTrigger>
          </Reveal>
        </div>

        <ul className="mt-14 grid auto-rows-auto grid-cols-2 gap-3 sm:gap-4 lg:mt-20 lg:grid-cols-4">
          {gallery.map((item, i) => (
            <Reveal as="li" key={item.id} delay={(i % 4) * 0.07} y={36} className={`${shapeClass[item.shape]} relative`}>
              <button
                type="button"
                onClick={(e) => {
                  lastTrigger.current = e.currentTarget;
                  setDir(1);
                  setOpenIndex(i);
                }}
                aria-label={`Ampliar: ${item.caption ?? item.alt}`}
                className="group relative block h-full w-full overflow-hidden rounded-sm border border-line bg-ink-2"
              >
                <div className="h-full w-full transition-transform duration-[1.2s] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.06]">
                  {item.src ? (
                    <img src={item.src} alt={item.alt} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <Placeholder index={i} />
                  )}
                </div>
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/0 to-ink/0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span
                  aria-hidden
                  className="absolute inset-x-4 bottom-4 flex translate-y-3 items-center justify-between opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
                >
                  <span className="truncate text-sm font-semibold text-ice">{item.caption ?? "Ampliar foto"}</span>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gold text-ink">
                    <Expand className="size-4" />
                  </span>
                </span>
              </button>
            </Reveal>
          ))}
        </ul>

        <Reveal className="mt-10 lg:hidden">
          <BookingTrigger variant="outline" className="w-full">
            Quero um visual assim
          </BookingTrigger>
        </Reveal>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {current && openIndex !== null && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Foto ${openIndex + 1} de ${total}`}
            className="fixed inset-0 z-[90] flex flex-col bg-black/95 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center justify-between px-4 py-4 sm:px-8">
              <p className="text-sm font-semibold tracking-[0.2em] text-mute tabular-nums">
                <span className="text-gold">{String(openIndex + 1).padStart(2, "0")}</span> / {String(total).padStart(2, "0")}
              </p>
              <button
                ref={closeRef}
                onClick={close}
                aria-label="Fechar galeria"
                className="grid size-12 place-items-center rounded-full border border-line text-ice transition hover:rotate-90 hover:border-gold hover:text-gold"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-4 sm:px-20">
              <AnimatePresence mode="popLayout" initial={false} custom={dir}>
                <motion.figure
                  key={current.id}
                  custom={dir}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 80, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -80, scale: 0.96 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  drag={reduce ? false : "x"}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.25}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -70) go(1);
                    else if (info.offset.x > 70) go(-1);
                  }}
                  className="flex max-h-full w-full max-w-4xl cursor-grab flex-col items-center active:cursor-grabbing"
                >
                  <div className="relative aspect-[4/5] max-h-[72dvh] w-full max-w-[min(100%,58dvh)] overflow-hidden rounded-sm border border-line sm:max-w-[min(100%,60dvh)]">
                    {current.src ? (
                      <img src={current.src} alt={current.alt} className="pointer-events-none h-full w-full object-cover" draggable={false} />
                    ) : (
                      <Placeholder index={openIndex} large />
                    )}
                  </div>
                  <figcaption className="mt-4 text-center text-sm text-mute">{current.caption ?? current.alt}</figcaption>
                </motion.figure>
              </AnimatePresence>

              <button
                onClick={() => go(-1)}
                aria-label="Foto anterior"
                className="absolute top-1/2 left-2 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-line bg-ink/70 text-ice transition hover:border-gold hover:text-gold sm:left-6"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                onClick={() => go(1)}
                aria-label="Próxima foto"
                className="absolute top-1/2 right-2 grid size-12 -translate-y-1/2 place-items-center rounded-full border border-line bg-ink/70 text-ice transition hover:border-gold hover:text-gold sm:right-6"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>

            <div className="flex justify-center gap-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]" aria-hidden>
              {gallery.map((g, i) => (
                <span key={g.id} className={`h-1 rounded-full transition-all duration-500 ${i === openIndex ? "w-8 bg-gold" : "w-2 bg-line"}`} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
