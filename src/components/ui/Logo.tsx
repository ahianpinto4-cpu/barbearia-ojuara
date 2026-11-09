/* eslint-disable @next/next/no-img-element */
import { site } from "@/config/site";

type Props = {
  className?: string;
  /** "header": faixa sem contatos · "full": logo completo com Instagram e WhatsApp */
  variant?: "header" | "full";
  priority?: boolean;
};

const assets = {
  header: { src: "/brand/logo-header.webp", width: 520, height: 163 },
  full: { src: "/brand/logo-full.webp", width: 900, height: 282 },
} as const;

/** Logotipo oficial da Barbearia Ojuara (arquivos em /public/brand). */
export function Logo({ className = "", variant = "header", priority = false }: Props) {
  const a = assets[variant];
  return (
    <img
      src={a.src}
      width={a.width}
      height={a.height}
      alt={site.name}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      className={`block select-none ${className}`}
      draggable={false}
    />
  );
}
