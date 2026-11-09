import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "gold" | "outline" | "ghost";
type Size = "md" | "lg";

const base =
  "group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-[2px] font-sans font-bold uppercase tracking-[0.18em] transition-all duration-500 ease-[cubic-bezier(.22,1,.36,1)] disabled:cursor-not-allowed disabled:opacity-40 select-none";

const variants: Record<Variant, string> = {
  gold:
    "bg-gold text-ink hover:bg-gold-soft shadow-[0_10px_30px_-12px_rgba(201,164,76,.6)] hover:shadow-[0_18px_40px_-14px_rgba(201,164,76,.75)] hover:-translate-y-0.5 active:translate-y-0",
  outline:
    "border border-ice/25 text-ice hover:border-gold hover:text-gold bg-ink/30 backdrop-blur-sm hover:-translate-y-0.5 active:translate-y-0",
  ghost: "text-gold hover:text-gold-soft",
};

const sizes: Record<Size, string> = {
  md: "min-h-12 px-6 text-[0.7rem]",
  lg: "min-h-14 px-8 text-xs sm:text-[0.8rem]",
};

export function buttonClasses(variant: Variant = "gold", size: Size = "lg", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`;
}

/** Brilho que atravessa o botão no hover (somente no dourado). */
function Sheen({ variant }: { variant: Variant }) {
  if (variant !== "gold") return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/35 opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100"
    />
  );
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  external?: boolean;
};

export function ButtonLink({ variant = "gold", size = "lg", className = "", children, external, ...rest }: LinkProps) {
  return (
    <a
      className={buttonClasses(variant, size, className)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      {...rest}
    >
      <Sheen variant={variant} />
      {children}
    </a>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; children: ReactNode };

export function Button({ variant = "gold", size = "lg", className = "", children, type = "button", ...rest }: BtnProps) {
  return (
    <button type={type} className={buttonClasses(variant, size, className)} {...rest}>
      <Sheen variant={variant} />
      {children}
    </button>
  );
}
