import { ImageResponse } from "next/og";
import { site } from "@/config/site";

export const alt = "Barbearia Ojuara — Estilo, qualidade e tradição em São Cristóvão - SE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#080808",
          padding: "70px 80px",
          color: "#F5F5F5",
          border: "2px solid #C9A44C",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, color: "#C9A44C", fontSize: 22, letterSpacing: 8 }}>
          <div style={{ width: 60, height: 2, background: "#C9A44C" }} />
          TRADIÇÃO, ESTILO E EXCELÊNCIA HÁ MAIS DE {site.yearsInBusiness} ANOS
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, letterSpacing: 14, color: "#A3A3A3" }}>BARBEARIA</div>
          <div style={{ fontSize: 140, letterSpacing: 10, fontWeight: 700, lineHeight: 1 }}>OJUARA</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#A3A3A3" }}>
          <span>{site.rating.toLocaleString("pt-BR")} estrelas no Google Maps</span>
          <span>
            {site.address.city} - {site.address.state} · {site.contact.phoneDisplay}
          </span>
        </div>
      </div>
    ),
    size,
  );
}
