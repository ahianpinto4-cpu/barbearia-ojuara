"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { whatsappLink } from "@/lib/links";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

/** Botão flutuante do WhatsApp — sempre acessível após a primeira dobra. */
export function FloatingWhatsApp() {
  const [visible, setVisible] = useState(false);
  const [hint, setHint] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > window.innerHeight * 0.5);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t1 = setTimeout(() => setHint(true), 1200);
    const t2 = setTimeout(() => setHint(false), 6500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-3 sm:right-6 sm:bottom-6"
        >
          <AnimatePresence>
            {hint && (
              <motion.span
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="hidden rounded-sm border border-line bg-ink-2/95 px-4 py-2.5 text-sm text-ice shadow-xl backdrop-blur sm:block"
              >
                Agende pelo WhatsApp
              </motion.span>
            )}
          </AnimatePresence>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Agendar pelo WhatsApp"
            onMouseEnter={() => setHint(true)}
            onMouseLeave={() => setHint(false)}
            className="group relative grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_32px_-8px_rgba(37,211,102,.55)] transition-transform duration-300 hover:scale-110"
          >
            <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-20 [animation-duration:2.6s]" />
            <WhatsAppIcon className="relative size-7" />
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
