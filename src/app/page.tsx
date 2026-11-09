import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { FloatingWhatsApp } from "@/components/layout/FloatingWhatsApp";
import { Hero } from "@/components/sections/Hero";
import { About } from "@/components/sections/About";
import { Services } from "@/components/sections/Services";
import { Gallery } from "@/components/sections/Gallery";
import { Reviews } from "@/components/sections/Reviews";
import { BookingCTA } from "@/components/sections/BookingCTA";
import { Location } from "@/components/sections/Location";

export default function Home() {
  return (
    <>
      <Header />
      <main id="conteudo">
        <Hero />
        <About />
        <Services />
        <Gallery />
        <Reviews />
        <BookingCTA />
        <Location />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </>
  );
}
