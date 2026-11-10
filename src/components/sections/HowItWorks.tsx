import { CalendarCheck2, MessageCircle, Repeat2 } from "lucide-react";
import { whatsappLink } from "@/lib/links";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { WhatsAppIcon } from "@/components/ui/WhatsAppIcon";

const steps = [
  {
    icon: MessageCircle,
    title: "Chame a Ojuara no WhatsApp",
    text: "Toque em agendar e envie a mensagem que já vem pronta. Você é atendido na hora pelo assistente virtual da barbearia.",
  },
  {
    icon: CalendarCheck2,
    title: "Escolha serviço, dia e horário",
    text: "O assistente consulta a agenda real, mostra os horários livres e confirma tudo com você antes de reservar.",
  },
  {
    icon: Repeat2,
    title: "Da próxima vez, é só voltar à conversa",
    text: "Remarcar, cancelar ou agendar de novo: tudo pela mesma conversa. Se preferir, um atendente da equipe assume.",
  },
];

/** Explica o atendimento pelo WhatsApp e conduz para a conversa. */
export function HowItWorks() {
  return (
    <section id="como-agendar" aria-labelledby="como-agendar-titulo" className="relative overflow-hidden bg-ink py-24 sm:py-32">
      <div aria-hidden className="pointer-events-none absolute top-1/2 -right-40 h-[28rem] w-[28rem] -translate-y-1/2 rounded-full bg-ember/[0.07] blur-3xl" />
      <div className="container-luxe relative">
        <SectionHeading
          index="05"
          eyebrow="Como agendar"
          id="como-agendar-titulo"
          title={
            <>
              Agendar ficou simples. <span className="text-gold italic">Tudo pelo WhatsApp.</span>
            </>
          }
          subtitle="Sem cadastro, sem aplicativo novo. Você conversa com a Ojuara do jeito que já está acostumado."
        />
        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <Reveal as="li" key={title} delay={i * 0.1}>
              <div className="group relative h-full rounded-sm border border-line bg-ink-2 p-7 transition-colors duration-500 hover:border-gold/40">
                <span className="font-display text-5xl text-gold/25 transition-colors duration-500 group-hover:text-gold/45">0{i + 1}</span>
                <Icon className="absolute top-7 right-7 size-6 text-gold" strokeWidth={1.25} aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-ice">{title}</h3>
                <p className="mt-2 leading-relaxed text-mute">{text}</p>
              </div>
            </Reveal>
          ))}
        </ol>
        <Reveal delay={0.2} className="mt-12 flex flex-col gap-3 sm:flex-row">
          <ButtonLink href={whatsappLink()} external className="w-full sm:w-auto">
            <WhatsAppIcon className="size-5" />
            Reservar meu horário
          </ButtonLink>
          <ButtonLink
            href={whatsappLink("Olá! Vim pelo site da Barbearia Ojuara e gostaria de tirar uma dúvida.")}
            external
            variant="outline"
            className="w-full sm:w-auto"
          >
            Falar com a Ojuara
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  );
}
