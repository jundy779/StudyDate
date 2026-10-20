/* eslint-disable @next/next/no-img-element -- ImageResponse (Satori) hanya mengenal <img>. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { verifyCertificate } from "@/lib/events/after";
import {
  CERTIFICATE_BASIS_LABELS,
  CERTIFICATE_CODE_PATTERN,
  normalizeCertificateCode,
} from "@/lib/events/after-rules";

const NAVY = "#0F1B33";
const BLUE = "#014FE7";

async function asset(path: string) {
  const bytes = await readFile(join(process.cwd(), "public", path));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normalizeCertificateCode(decodeURIComponent(raw));
  if (!CERTIFICATE_CODE_PATTERN.test(code)) return new Response("Not found", { status: 404 });
  const certificate = await verifyCertificate(code);
  if (!certificate || certificate.status !== "valid") {
    return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const [logo, mascot, poppinsBold] = await Promise.all([
    asset("brand/logo-horizontal-color.png"),
    asset("brand/mascot/expressions/girang-sticker.png"),
    readFile(join(process.cwd(), "assets/fonts/Poppins-Bold.ttf")),
  ]);
  const poppinsRegular = await readFile(join(process.cwd(), "assets/fonts/Poppins-Regular.ttf"));
  const date = new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: certificate.eventTimezone,
  }).format(new Date(certificate.eventStartsAt));
  const name = certificate.recipientName;
  const title =
    certificate.eventTitle.length > 90 ? `${certificate.eventTitle.slice(0, 88)}...` : certificate.eventTitle;

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          padding: 48,
          background: "#F5F7FB",
          fontFamily: "Poppins",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 80px",
            border: `5px solid ${NAVY}`,
            borderRadius: 32,
            boxShadow: `12px 12px 0 ${NAVY}`,
            backgroundColor: "#FFFFFF",
            backgroundImage:
              "repeating-linear-gradient(0deg, transparent 0px, transparent 46px, #E3EAF7 46px, #E3EAF7 47px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <img src={logo} width={300} height={68} alt="" />
            <div
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 999,
                border: `3px solid ${NAVY}`,
                background: "#E8FFF1",
                color: "#0B6B3A",
                fontSize: 24,
                fontWeight: 700,
              }}
            >
              Terverifikasi StudyDate
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 40, color: BLUE, fontWeight: 700, fontFamily: "Poppins" }}>
              Sertifikat Kehadiran
            </div>
            <div style={{ display: "flex", marginTop: 28, fontSize: 28, color: "#4B5565" }}>
              Diberikan kepada
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 6,
                fontSize: name.length > 40 ? 64 : 84,
                fontWeight: 700,
                fontFamily: "Poppins",
                letterSpacing: "-0.02em",
                color: NAVY,
                borderBottom: "14px solid #FFDC72",
                alignSelf: "flex-start",
                lineHeight: 1.1,
              }}
            >
              {name}
            </div>
            <div style={{ display: "flex", marginTop: 34, fontSize: 28, color: "#4B5565" }}>
              atas keikutsertaan dalam
            </div>
            <div style={{ display: "flex", marginTop: 6, fontSize: 44, fontWeight: 700, fontFamily: "Poppins", color: NAVY, maxWidth: 1350 }}>
              {title}
            </div>
            <div style={{ display: "flex", marginTop: 14, fontSize: 28, color: NAVY }}>
              {`${date} · diselenggarakan oleh ${certificate.organizerAlias}${certificate.isOfficial ? " · Acara resmi StudyDate" : ""}`}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 24, color: "#4B5565" }}>
              <div style={{ display: "flex" }}>{`Dasar: ${CERTIFICATE_BASIS_LABELS[certificate.attendanceBasis]}`}</div>
              <div style={{ display: "flex", marginTop: 6, color: NAVY, fontWeight: 700 }}>{`Kode cek: ${code}`}</div>
              <div style={{ display: "flex", marginTop: 6 }}>{`studydate.id/certificates/${code}`}</div>
            </div>
            <img src={mascot} width={170} height={170} alt="" />
          </div>
        </div>
      </div>
    ),
    {
      width: 1754,
      height: 1240,
      fonts: [
        { name: "Poppins", data: poppinsRegular, weight: 400, style: "normal" },
        { name: "Poppins", data: poppinsBold, weight: 700, style: "normal" },
      ],
    },
  );
  image.headers.set("Cache-Control", "no-store");
  image.headers.set("X-Robots-Tag", "noindex");
  return image;
}
