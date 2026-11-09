import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { site } from "@/config/site";

export const alt = "Barbearia Ojuara — Estilo, qualidade e tradição em São Cristóvão - SE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "src/assets/logo-og.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(ellipse at center, #1c1710 0%, #080808 70%)",
          color: "#F5F5F5",
          gap: 36,
        }}
      >
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <img src={logoSrc} width={900} height={282} />
        <div style={{ display: "flex", fontSize: 30, letterSpacing: 6, color: "#C9A44C" }}>
          MAIS DE {site.yearsInBusiness} ANOS · {site.rating.toLocaleString("pt-BR")} ESTRELAS NO GOOGLE
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#A3A3A3" }}>
          {site.address.neighborhood}, {site.address.city} - {site.address.state} · Agende pelo WhatsApp
        </div>
      </div>
    ),
    size,
  );
}
