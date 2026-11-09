import { Star } from "lucide-react";

/** Estrelas com preenchimento proporcional (ex.: 4,9). */
export function Stars({ value, size = 18, className = "" }: { value: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`} role="img" aria-label={`${value.toLocaleString("pt-BR")} de 5 estrelas`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }} aria-hidden>
            <Star className="absolute inset-0 text-gold/25" style={{ width: size, height: size }} strokeWidth={1.5} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star className="text-gold" fill="currentColor" style={{ width: size, height: size }} strokeWidth={1.5} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
