type Props = { className?: string; compact?: boolean };

/** Monograma + logotipo tipográfico da Barbearia Ojuara. */
export function Logo({ className = "", compact = false }: Props) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <svg viewBox="0 0 40 40" className="size-9 shrink-0 text-gold" aria-hidden>
        <circle cx="20" cy="20" r="18.5" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="20" cy="20" r="15.5" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.5" />
        <ellipse cx="20" cy="20" rx="6.2" ry="8.6" fill="none" stroke="currentColor" strokeWidth="2.2" />
        <path d="M20 4.5v4M20 31.5v4" stroke="currentColor" strokeWidth="1" />
      </svg>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-sans text-[0.55rem] font-semibold tracking-[0.42em] text-mute uppercase">Barbearia</span>
          <span className="mt-1 font-display text-[1.35rem] font-semibold tracking-[0.14em] text-ice uppercase">Ojuara</span>
        </span>
      )}
    </span>
  );
}
