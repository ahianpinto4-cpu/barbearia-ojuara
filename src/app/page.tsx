import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FloatingWhatsApp } from "@/components/layout/FloatingWhatsApp";
import { Hero } from "@/components/sections/Hero";
import { About } from "@/components/sections/About";
import { Services } from "@/components/sections/Services";
import { Gallery } from "@/components/sections/Gallery";
import { Reviews } from "@/components/sections/Reviews";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { BookingCTA } from "@/components/sections/BookingCTA";
import { Location } from "@/components/sections/Location";
import { Intro } from "@/components/animations/Intro";
import { getPublicServices } from "@/lib/server/public-data";

/** Serviços e preços vêm do painel; a página é regenerada a cada 5 minutos. */
export const revalidate = 300;

export default async function Home() {
  const { services } = await getPublicServices();
  return (
    <>
      <div id="intro-cover" aria-hidden="true" />
      <Intro />
      <Header />
      <main id="conteudo">
        <Hero />
        <About />
        <Services services={services} />
        <Gallery />
        <Reviews />
        <HowItWorks />
        <BookingCTA />
        <Location />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
