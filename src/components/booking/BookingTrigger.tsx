"use client";

import type { ReactNode } from "react";
import { buttonClasses } from "@/components/ui/ButtonLink";
import { whatsappLink } from "@/lib/links";
import { useBooking } from "./BookingProvider";

type Props = {
  children: ReactNode;
  serviceId?: string;
  variant?: "gold" | "outline" | "ghost";
  size?: "md" | "lg";
  className?: string;
  unstyled?: boolean;
  onOpen?: () => void;
};

/**
 * Abre o assistente de agendamento. Sem JavaScript, o link leva direto ao
 * WhatsApp (melhoria progressiva).
 */
export function BookingTrigger({ children, serviceId, variant = "gold", size = "lg", className = "", unstyled, onOpen }: Props) {
  const { open } = useBooking();
  return (
    <a
      href={whatsappLink()}
      onClick={(e) => {
        e.preventDefault();
        onOpen?.();
        open(serviceId);
      }}
      aria-haspopup="dialog"
      className={unstyled ? className : buttonClasses(variant, size, className)}
    >
      {variant === "gold" && !unstyled && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/35 opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100"
        />
      )}
      {children}
    </a>
  );
}
