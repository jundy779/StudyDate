import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "StudyDate ID — Teman, circle, dan acara kampus";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const logoBytes = await readFile(
    join(process.cwd(), "public/brand/logo-horizontal-color.png"),
  );
  const logoSrc = `data:image/png;base64,${logoBytes.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(145deg, #F5F7FB 0%, #E8EEF8 48%, #FFFFFF 100%)",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <img src={logoSrc} width={280} height={64} alt="" />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.1,
              color: "#0F1B33",
              maxWidth: 920,
            }}
          >
            Temukan teman dan kegiatan di kampus
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              lineHeight: 1.45,
              color: "#4B5565",
              maxWidth: 820,
            }}
          >
            Cari teman belajar, gabung circle kecil, dan temukan acara kampus
            tanpa langsung membagikan nama atau kontak.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 18,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#1565D8",
              fontWeight: 700,
            }}
          >
            TEMUKAN · KENALAN · TERHUBUNG
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 600,
              color: "#0F1B33",
            }}
          >
            studydate.id
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
