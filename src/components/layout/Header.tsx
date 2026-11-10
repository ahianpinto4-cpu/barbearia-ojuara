"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { MapPin, Menu, Phone, X } from "lucide-react";
import { InstagramIcon } from "@/components/ui/InstagramIcon";
import { useEffect, useState } from "react";
import { navLinks, site } from "@/config/site";
import { phoneHref, whatsappLink } from "@/lib/links";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Logo } from "@/components/ui/Logo";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>("");
  const reduce = useReducedMotion();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Destaca o link da seção visível
  useEffect(() => {
    const ids = navLinks.map((l) => l.href.slice(1));
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(`#${e.target.id}`)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled || open ? "border-b border-line/80 bg-ink/85 backdrop-blur-xl" : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className={`container-luxe flex items-center justify-between transition-all duration-500 ${scrolled ? "h-16 lg:h-[4.5rem]" : "h-20 lg:h-24"}`}>
        <a href="#inicio" aria-label={`${site.name} — início`} className="relative z-10" onClick={() => setOpen(false)}>
          <Logo priority className={`w-auto transition-all duration-500 ${scrolled ? "h-10 lg:h-12" : "h-12 lg:h-[3.75rem]"}`} />
        </a>

        <nav aria-label="Principal" className="hidden lg:block">
          <ul className="flex items-center gap-9">
            {navLinks.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  className={`group relative py-2 text-[0.72rem] font-semibold tracking-[0.2em] uppercase transition-colors ${
                    active === l.href ? "text-gold" : "text-ice/80 hover:text-ice"
                  }`}
                >
                  {l.label}
                  <span
                    className={`absolute -bottom-0.5 left-0 h-px bg-gold transition-all duration-500 ${active === l.href ? "w-full" : "w-0 group-hover:w-full"}`}
                  />
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden sm:block">
            <ButtonLink href={whatsappLink()} external size="md">Agendar meu corte</ButtonLink>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            className="relative z-10 grid size-12 place-items-center rounded-full border border-line text-ice transition hover:border-gold hover:text-gold lg:hidden"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={open ? "x" : "m"}
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="menu-mobile"
            initial={reduce ? { opacity: 0 } : { opacity: 0, clipPath: "inset(0 0 100% 0)" }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, clipPath: "inset(0 0 0% 0)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-x-0 top-0 -z-10 flex h-dvh flex-col bg-ink px-5 pt-28 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-8 lg:hidden"
          >
            <nav aria-label="Menu mobile" className="flex-1 overflow-y-auto pb-6">
              <ul className="space-y-1">
                {navLinks.map((l, i) => (
                  <motion.li
                    key={l.href}
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <a
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="flex items-baseline gap-4 border-b border-line py-4 font-display text-3xl text-ice transition-colors hover:text-gold"
                    >
                      <span className="font-sans text-xs tracking-widest text-gold tabular-nums">0{i + 1}</span>
                      {l.label}
                    </a>
                  </motion.li>
                ))}
              </ul>
            </nav>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="space-y-4"
            >
              <ButtonLink href={whatsappLink()} external className="w-full" onClick={() => setOpen(false)}>
                Agendar pelo WhatsApp
              </ButtonLink>
              <div className="flex flex-col gap-2 text-sm text-mute">
                <a href={phoneHref} className="inline-flex items-center gap-2 hover:text-gold">
                  <Phone className="size-4 text-gold" /> {site.contact.phoneDisplay}
                </a>
                {site.links.instagram && (
                  <a href={site.links.instagram} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-gold">
                    <InstagramIcon className="size-4 text-gold" /> {site.links.instagramHandle}
                  </a>
                )}
                <span className="inline-flex items-start gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-gold" /> {site.address.full}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
