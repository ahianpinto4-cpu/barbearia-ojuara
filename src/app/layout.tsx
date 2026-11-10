import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import { Providers } from "@/components/Providers";
import { localBusinessJsonLd, seo, siteUrl } from "@/lib/seo";
import { site } from "@/config/site";
import "./globals.css";

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: seo.title,
  description: seo.description,
  applicationName: site.name,
  keywords: [
    "barbearia",
    "Barbearia Ojuara",
    "barbearia São Cristóvão",
    "barbearia Rosa Elze",
    "corte masculino",
    "barba",
    "São Cristóvão SE",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: site.name,
    title: seo.title,
    description: seo.description,
  },
  twitter: {
    card: "summary_large_image",
    title: seo.title,
    description: seo.description,
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: true, address: true },
};

export const viewport: Viewport = {
  themeColor: "#080808",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${bodoni.variable} ${manrope.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* Decide antes da primeira pintura se a abertura 3D vai tocar (evita "piscar" a página). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(location.pathname==="/"&&!localStorage.getItem("ojuara:intro:v1")&&!matchMedia("(prefers-reduced-motion: reduce)").matches&&!/[?&]intro=0/.test(location.search))document.documentElement.dataset.intro="play"}catch(e){}`,
          }}
        />
      </head>
      <body>
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:bg-gold focus:px-4 focus:py-3 focus:font-semibold focus:text-ink"
        >
          Pular para o conteúdo
        </a>
        <Providers>{children}</Providers>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd()).replace(/</g, "\\u003c") }}
        />
      </body>
    </html>
  );
}
