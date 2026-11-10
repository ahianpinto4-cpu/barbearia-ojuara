import { CalendarCheck } from "lucide-react";
import { ambientImages, site } from "@/config/site";
import { whatsappLink } from "@/lib/links";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Reveal } from "@/components/ui/Reveal";
import { SafeImage } from "@/components/ui/SafeImage";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";
import { BookingTrigger } from "@/components/booking/BookingTrigger";

export function BookingCTA() {
  return (
    <section id="agendar" aria-labelledby="cta-titulo" className="relative isolate overflow-hidden bg-ink py-28 sm:py-36 lg:py-44">
      <div className="absolute inset-0 -z-20">
        <SafeImage src={ambientImages.cta.src} alt="" sizes="100vw" width={1920} className="absolute inset-0 h-full w-full object-cover grayscale-[40%]" />
      </div>
      <div aria-hidden className="absolute inset-0 -z-10 bg-ink/80" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_0%,#080808_75%)]" />

      <div className="container-luxe">
        <div className="relative mx-auto max-w-4xl border border-gold/25 px-6 py-14 text-center sm:px-14 sm:py-20">
          {/* Cantoneiras douradas */}
          {["-top-px -left-px border-t-2 border-l-2", "-top-px -right-px border-t-2 border-r-2", "-bottom-px -left-px border-b-2 border-l-2", "-bottom-px -right-px border-b-2 border-r-2"].map((c) => (
            <span key={c} aria-hidden className={`absolute size-6 border-gold ${c}`} />
          ))}

          <Reveal>
            <p className="eyebrow justify-center">Agende agora</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 id="cta-titulo" className="mx-auto mt-6 max-w-3xl font-display text-4xl leading-[1.06] font-medium text-balance text-ice sm:text-6xl lg:text-7xl">
              Seu próximo visual começa com <span className="text-gold italic">uma escolha.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="mx-auto mt-7 max-w-xl text-base leading-relaxed text-ice/75 sm:text-lg">
              Não deixe seu estilo para depois. Escolha seu serviço e entre em contato com a nossa equipe para reservar seu
              horário.
            </p>
          </Reveal>
          <Reveal delay={0.24} className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <ButtonLink href={whatsappLink(site.messages.general)} external className="w-full sm:w-auto">
              <WhatsAppIcon className="size-5" />
              Agendar meu corte
            </ButtonLink>
            <BookingTrigger variant="outline" className="w-full sm:w-auto">
              <CalendarCheck className="size-4" />
              Montar meu pedido aqui
            </BookingTrigger>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mt-6 text-sm text-mute">
              Atendimento pelo WhatsApp <span className="text-ice">{site.contact.phoneDisplay}</span>
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
