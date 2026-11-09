import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

type Props = {
  index: string;
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  align?: "left" | "center";
  id?: string;
};

export function SectionHeading({ index, eyebrow, title, subtitle, align = "left", id }: Props) {
  const centered = align === "center";
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <Reveal>
        <p className={`eyebrow ${centered ? "justify-center" : ""}`}>
          <span className="text-mute-2 tabular-nums">{index}</span>
          <span>{eyebrow}</span>
        </p>
      </Reveal>
      <Reveal delay={0.08}>
        <h2 id={id} className="mt-5 font-display text-[2.15rem] leading-[1.08] font-medium tracking-[-0.01em] text-balance text-ice sm:text-5xl lg:text-[3.6rem]">
          {title}
        </h2>
      </Reveal>
      {subtitle && (
        <Reveal delay={0.16}>
          <p className="mt-5 text-base leading-relaxed text-pretty text-mute sm:text-lg">{subtitle}</p>
        </Reveal>
      )}
    </div>
  );
}
