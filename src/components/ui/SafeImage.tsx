"use client";
/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { remoteSrc, remoteSrcSet } from "@/lib/links";

type SafeImageProps = {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
  width?: number;
  /** Conteúdo exibido se a imagem falhar. Padrão: textura com ícone discreto. */
  fallback?: React.ReactNode;
};

/**
 * Imagem com carregamento progressivo (skeleton), lazy loading, formatos
 * modernos via CDN e alternativa elegante caso a imagem não carregue.
 */
export function SafeImage({ src, alt, className = "", sizes = "100vw", priority = false, width = 1280, fallback }: SafeImageProps) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  if (state === "error") {
    if (fallback) return <>{fallback}</>;
    return (
      <div role="img" aria-label={alt} className={`placeholder-pattern flex items-center justify-center ${className}`}>
        <ImageOff aria-hidden className="size-7 text-gold/40" strokeWidth={1.25} />
      </div>
    );
  }

  return (
    <>
      {state === "loading" && <div aria-hidden className={`shimmer absolute inset-0`} />}
      <img
        src={remoteSrc(src, width)}
        srcSet={remoteSrcSet(src)}
        sizes={sizes}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0 && state === "loading") setState("loaded");
        }}
        onLoad={() => setState("loaded")}
        onError={() => setState("error")}
        className={`${className} transition-opacity duration-700 ${state === "loaded" ? "opacity-100" : "opacity-0"}`}
      />
    </>
  );
}
