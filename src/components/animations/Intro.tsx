"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "motion/react";
import { Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui/Logo";

/**
 * Abertura cinematográfica (primeira visita).
 * - Carrega o Three.js apenas quando a abertura vai tocar.
 * - Botão "PULAR INTRO" sempre visível; Esc também pula.
 * - Sem WebGL: versão 2D com revelação da marca.
 * - "Reduzir movimento" no sistema: não toca.
 * - Pode ser revista pelo link "Rever abertura" no rodapé.
 */
export const INTRO_STORAGE_KEY = "ojuara:intro:v1";
const SOUND_KEY = "ojuara:intro-sound";
export const REPLAY_EVENT = "ojuara:replay-intro";

const ClipperScene = dynamic(() => import("./ClipperScene"), { ssr: false });

type Phase = "off" | "scene" | "brand" | "leaving";

function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

function playImpactSound() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    // "puf": ruído filtrado com varredura descendente
    const len = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1400, now);
    lp.frequency.exponentialRampToValueAtTime(160, now + 0.5);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, now);
    ng.gain.exponentialRampToValueAtTime(0.35, now + 0.015);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    noise.connect(lp).connect(ng).connect(ctx.destination);
    // impacto grave
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(95, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.35);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.0001, now);
    og.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.connect(og).connect(ctx.destination);
    noise.start(now);
    osc.start(now);
    osc.stop(now + 0.45);
    setTimeout(() => ctx.close(), 900);
  } catch {
    /* áudio é opcional */
  }
}

export function Intro() {
  const [phase, setPhase] = useState<Phase>("off");
  const [webgl, setWebgl] = useState(true);
  const [lowPower, setLowPower] = useState(false);
  const [sound, setSound] = useState(false);
  const [ready, setReady] = useState(false);
  const [impact, setImpact] = useState(false);
  const timers = useRef<number[]>([]);
  const soundRef = useRef(false);
  const revealed = useRef(false);
  const fallback = useRef<number | undefined>(undefined);

  const clearTimers = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    window.clearTimeout(fallback.current);
  };

  /** Plano B: se a cena não avançar, revela a marca mesmo assim. */
  const armFallback = (ms: number, reveal: () => void) => {
    window.clearTimeout(fallback.current);
    fallback.current = window.setTimeout(reveal, ms);
  };

  const finish = useCallback(() => {
    clearTimers();
    setPhase("leaving");
    timers.current.push(
      window.setTimeout(() => {
        setPhase("off");
        delete document.documentElement.dataset.intro;
        document.body.style.overflow = "";
      }, 750),
    );
  }, []);

  /** Revela a marca e agenda a dissolução (sincronizado com o impacto real da cena). */
  const revealBrand = useCallback(
    (delay = 0) => {
      if (revealed.current) return;
      revealed.current = true;
      timers.current.push(window.setTimeout(() => setPhase((p) => (p === "off" ? p : "brand")), delay));
      timers.current.push(window.setTimeout(finish, delay + 2200));
    },
    [finish],
  );

  const begin = useCallback(() => {
    clearTimers();
    revealed.current = false;
    const gl = hasWebGL();
    setWebgl(gl);
    setLowPower(window.matchMedia("(max-width: 767px)").matches || (navigator.hardwareConcurrency ?? 8) <= 4);
    try {
      localStorage.setItem(INTRO_STORAGE_KEY, "1");
      const s = localStorage.getItem(SOUND_KEY) === "1";
      setSound(s);
      soundRef.current = s;
    } catch {
      /* armazenamento indisponível */
    }
    document.documentElement.dataset.intro = "play";
    document.body.style.overflow = "hidden";
    setReady(false);
    setImpact(false);
    if (gl) {
      setPhase("scene");
      // Se a cena 3D não começar em 3 s (aparelho lento), mostra só a marca.
      armFallback(3000, () => revealBrand());
    } else {
      setPhase("brand");
      timers.current.push(window.setTimeout(finish, 2300));
    }
  }, [finish, revealBrand]);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.documentElement.dataset.intro === "play" && !reduce) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- inicia a abertura decidida antes da hidratação
      begin();
    } else {
      delete document.documentElement.dataset.intro;
    }
    const replay = () => begin();
    window.addEventListener(REPLAY_EVENT, replay);
    return () => {
      window.removeEventListener(REPLAY_EVENT, replay);
      clearTimers();
    };
  }, [begin]);

  useEffect(() => {
    if (phase === "off") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, finish]);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    soundRef.current = next;
    try {
      localStorage.setItem(SOUND_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  if (phase === "off") return null;
  const showBrand = phase === "brand" || phase === "leaving";

  return (
    <motion.div
      role="dialog"
      aria-label="Abertura da Barbearia Ojuara"
      className="fixed inset-0 z-[200] overflow-hidden bg-ink"
      data-phase={phase}
      data-ready={ready ? "1" : "0"}
      data-impact={impact ? "1" : "0"}
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === "leaving" ? 0 : 1, filter: phase === "leaving" ? "blur(6px)" : "blur(0px)" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      {webgl && (
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: showBrand ? 0.35 : 1 }}
          transition={{ duration: 0.9 }}
        >
          <ClipperScene
            lowPower={lowPower}
            onReady={() => {
              setReady(true);
              // a cena começou: aguarda o impacto (com um plano B mais longo)
              armFallback(4500, () => revealBrand());
            }}
            onImpact={() => {
              setImpact(true);
              window.clearTimeout(fallback.current);
              if (soundRef.current) playImpactSound();
              revealBrand(550);
            }}
          />
        </motion.div>
      )}

      {/* brilho dourado discreto */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(201,164,76,.14),transparent_60%)]" />

      <AnimatePresence>
        {showBrand && (
          <motion.div
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <motion.div
              initial={{ scale: 0.82, opacity: 0, filter: "blur(10px)" }}
              animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[34rem]"
            >
              <Logo variant="header" priority className="h-auto w-full drop-shadow-[0_20px_60px_rgba(223,52,12,.35)]" />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 14, letterSpacing: "0.6em" }}
              animate={{ opacity: 1, y: 0, letterSpacing: "0.32em" }}
              transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 font-sans text-sm font-semibold text-gold sm:text-lg"
            >
              SEU ESTILO COMEÇA AQUI.
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4 sm:p-6">
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label={sound ? "Desligar som da abertura" : "Ligar som da abertura"}
          className="grid size-11 place-items-center rounded-full border border-ice/15 text-ice/70 transition hover:border-gold hover:text-gold"
        >
          {sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
        </button>
        <button
          type="button"
          onClick={finish}
          autoFocus
          className="min-h-11 rounded-full border border-ice/20 bg-ink/60 px-5 text-[0.7rem] font-bold tracking-[0.2em] text-ice uppercase backdrop-blur transition hover:border-gold hover:text-gold"
        >
          Pular intro
        </button>
      </div>

      <motion.span
        aria-hidden
        className="absolute bottom-0 left-0 h-[2px] bg-gradient-to-r from-ember via-gold to-gold"
        initial={{ width: "0%" }}
        animate={{ width: "100%" }}
        transition={{ duration: webgl ? 4.5 : 2.3, ease: "linear" }}
      />
    </motion.div>
  );
}

/** Link discreto para rever a abertura. */
export function ReplayIntroButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        window.scrollTo({ top: 0 });
        window.dispatchEvent(new Event(REPLAY_EVENT));
      }}
    >
      Rever abertura
    </button>
  );
}
