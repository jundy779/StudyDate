"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";

type AcademicData = {
  nim: string;
  legalName: string;
  campus: string;
  studyProgram: string;
  degreeLevel: string;
};

const initialAcademicData: AcademicData = {
  nim: "",
  legalName: "",
  campus: "",
  studyProgram: "",
  degreeLevel: "",
};

export function VerificationForm() {
  const [step, setStep] = useState(0);
  const [academic, setAcademic] = useState(initialAcademicData);
  const [method, setMethod] = useState<"campus_email" | "student_card">(
    "campus_email",
  );
  const [campusEmail, setCampusEmail] = useState("");
  const [evidence, setEvidence] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  function updateAcademic(field: keyof AcademicData, value: string) {
    setAcademic((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  function nextStep() {
    setMessage("");
    if (
      step === 0 &&
      (!academic.nim.trim() ||
        !academic.legalName.trim() ||
        !academic.campus.trim() ||
        !academic.studyProgram.trim() ||
        !academic.degreeLevel)
    ) {
      setMessage("Lengkapi seluruh data akademik sebelum melanjutkan.");
      return;
    }
    if (step === 1) {
      if (method === "campus_email" && !campusEmail.trim()) {
        setMessage("Masukkan email kampus sebelum melanjutkan.");
        return;
      }
      if (method === "student_card" && !evidence) {
        setMessage("Pilih foto kartu mahasiswa sebelum melanjutkan.");
        return;
      }
    }
    setStep((current) => Math.min(current + 1, 2));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!consent) {
      setMessage("Persetujuan verifikasi harus diberikan secara terpisah.");
      return;
    }
    setIsBusy(true);
    setMessage("");
    const body = new FormData();
    Object.entries(academic).forEach(([key, value]) => body.set(key, value));
    body.set("method", method);
    body.set("consent", "true");
    if (evidence) body.set("evidence", evidence);

    try {
      const response = await fetch("/api/verification/submit", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as {
        requestId?: string;
        message?: string;
      };
      if (!response.ok || !result.requestId) {
        setMessage(
          result.message ??
            "Permintaan verifikasi belum dapat dikirim. Coba lagi.",
        );
        return;
      }
      setRequestId(result.requestId);
      if (method === "student_card") {
        setIsComplete(true);
        setMessage("Bukti terkirim dan akan diperiksa secara manual.");
      } else {
        setMessage(
          "Permintaan tersimpan. Kirim kode ke email kampus untuk membuktikan kepemilikan.",
        );
      }
    } catch {
      setMessage("Permintaan verifikasi belum dapat dikirim. Coba lagi.");
    } finally {
      setIsBusy(false);
    }
  }

  async function sendCode() {
    setIsBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/verification/campus-email/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, email: campusEmail }),
      });
      const result = (await response.json()) as { message?: string };
      setMessage(
        response.ok
          ? "Jika domain kampus didukung, kode telah dikirim. Kode berlaku 10 menit."
          : (result.message ?? "Kode belum dapat dikirim."),
      );
    } catch {
      setMessage("Kode belum dapat dikirim. Coba lagi.");
    } finally {
      setIsBusy(false);
    }
  }

  async function confirmCode() {
    setIsBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/verification/campus-email/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, code }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setMessage(result.message ?? "Kode belum dapat dikonfirmasi.");
        return;
      }
      setIsComplete(true);
      setMessage(
        "Email kampus terkonfirmasi. Pemeriksaan data akademik tetap dilakukan secara manual.",
      );
    } catch {
      setMessage("Kode belum dapat dikonfirmasi. Coba lagi.");
    } finally {
      setIsBusy(false);
    }
  }

  if (isComplete) {
    return (
      <section
        aria-labelledby="verification-sent"
        className="rounded-[24px] border border-brand-border bg-white p-6 sm:p-9"
      >
        <CheckCircle2 className="h-9 w-9 text-brand-success" aria-hidden="true" />
        <h2
          id="verification-sent"
          className="mt-5 font-heading text-2xl font-semibold"
        >
          Permintaan sedang diperiksa
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-brand-muted">
          {message} Status akan berubah hanya setelah pemeriksaan akademik dan
          bukti kepemilikan sama-sama selesai.
        </p>
      </section>
    );
  }

  if (requestId && method === "campus_email") {
    return (
      <section
        aria-labelledby="campus-code-title"
        className="rounded-[24px] border border-brand-border bg-white p-6 sm:p-9"
      >
        <ShieldCheck className="h-9 w-9 text-brand-blue" aria-hidden="true" />
        <h2
          id="campus-code-title"
          className="mt-5 font-heading text-2xl font-semibold"
        >
          Konfirmasi email kampus
        </h2>
        <p className="mt-3 max-w-2xl leading-7 text-brand-muted">
          Kode berlaku 10 menit, memiliki batas percobaan, dan hanya dapat
          dikirim ulang setelah jeda singkat.
        </p>
        <div className="mt-7 max-w-md">
          <button
            type="button"
            disabled={isBusy}
            onClick={sendCode}
            className="focus-ring min-h-12 w-full rounded-xl border border-brand-blue px-5 font-semibold text-brand-blue disabled:opacity-60"
          >
            Kirim kode verifikasi
          </button>
          <label
            htmlFor="verification-code"
            className="mt-6 block text-sm font-semibold"
          >
            Kode 6 digit
          </label>
          <input
            id="verification-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            className="focus-ring mt-2 h-12 w-full rounded-xl border border-brand-border px-4 tracking-[0.35em]"
          />
          <button
            type="button"
            disabled={isBusy || code.length !== 6}
            onClick={confirmCode}
            className="focus-ring mt-4 min-h-12 w-full rounded-xl bg-brand-blue px-5 font-semibold text-white disabled:opacity-60"
          >
            Konfirmasi kode
          </button>
        </div>
        <p className="mt-5 text-sm leading-6 text-brand-muted" aria-live="polite">
          {message}
        </p>
      </section>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-[24px] border border-brand-border bg-white p-5 shadow-[0_22px_60px_rgba(15,27,51,0.07)] sm:p-9"
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-semibold text-brand-blue">
          Langkah {step + 1} dari 3
        </p>
        <p className="text-sm text-brand-muted">
          {["Data akademik", "Bukti kepemilikan", "Persetujuan"][step]}
        </p>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-surface">
        <div
          className="h-full rounded-full bg-brand-blue transition-[width] motion-reduce:transition-none"
          style={{ width: `${((step + 1) / 3) * 100}%` }}
        />
      </div>

      {step === 0 ? (
        <fieldset className="mt-8">
          <legend className="font-heading text-2xl font-semibold">
            Data akademik
          </legend>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">
            Nama lengkap dan NIM hanya digunakan untuk verifikasi. Keduanya
            tidak ditampilkan pada profil publik.
          </p>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <Field id="nim" label="NIM" value={academic.nim} maxLength={32} onChange={(value) => updateAcademic("nim", value)} />
            <Field id="legal-name" label="Nama lengkap sesuai data akademik" value={academic.legalName} maxLength={160} autoComplete="name" onChange={(value) => updateAcademic("legalName", value)} />
            <Field id="verification-campus" label="Kampus" value={academic.campus} maxLength={120} onChange={(value) => updateAcademic("campus", value)} />
            <Field id="verification-program" label="Program studi" value={academic.studyProgram} maxLength={120} onChange={(value) => updateAcademic("studyProgram", value)} />
            <label className="block sm:col-span-2">
              <span className="text-sm font-semibold">Jenjang</span>
              <select
                value={academic.degreeLevel}
                onChange={(event) => updateAcademic("degreeLevel", event.target.value)}
                className="focus-ring mt-2 h-12 w-full rounded-xl border border-brand-border bg-white px-4"
              >
                <option value="">Pilih jenjang</option>
                <option value="diploma">Diploma</option>
                <option value="sarjana">Sarjana</option>
                <option value="magister">Magister</option>
                <option value="doktor">Doktor</option>
                <option value="profesi">Profesi</option>
                <option value="spesialis">Spesialis</option>
              </select>
            </label>
          </div>
        </fieldset>
      ) : null}

      {step === 1 ? (
        <fieldset className="mt-8">
          <legend className="font-heading text-2xl font-semibold">
            Bukti kepemilikan
          </legend>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">
            Pencocokan data akademik saja tidak membuktikan bahwa akun ini
            milik mahasiswa yang bersangkutan.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {[
              ["campus_email", "Email kampus", "Kode ke domain kampus yang telah disetujui."],
              ["student_card", "Kartu mahasiswa", "Foto diperiksa manual dan disimpan privat."],
            ].map(([value, title, description]) => (
              <label key={value} className="flex cursor-pointer gap-3 rounded-xl border border-brand-border p-4">
                <input type="radio" name="method" value={value} checked={method === value} onChange={() => setMethod(value as typeof method)} className="mt-1 accent-brand-blue" />
                <span><strong className="block">{title}</strong><span className="mt-1 block text-sm leading-6 text-brand-muted">{description}</span></span>
              </label>
            ))}
          </div>
          {method === "campus_email" ? (
            <Field id="campus-email" label="Email kampus" type="email" value={campusEmail} maxLength={254} autoComplete="email" onChange={setCampusEmail} className="mt-6 max-w-xl" />
          ) : (
            <label className="mt-6 block max-w-xl">
              <span className="text-sm font-semibold">Foto kartu mahasiswa</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setEvidence(event.target.files?.[0] ?? null)} className="focus-ring mt-2 block w-full rounded-xl border border-brand-border p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-brand-surface file:px-4 file:py-2 file:font-semibold" />
              <span className="mt-2 block text-xs leading-5 text-brand-muted">JPG, PNG, atau WebP. Maksimal 5 MB. File tidak tersedia secara publik.</span>
            </label>
          )}
        </fieldset>
      ) : null}

      {step === 2 ? (
        <fieldset className="mt-8">
          <legend className="font-heading text-2xl font-semibold">
            Persetujuan verifikasi
          </legend>
          <div className="mt-5 rounded-xl bg-brand-surface p-5 text-sm leading-6 text-brand-muted">
            <p>
              Proses ini menggunakan NIM, nama legal, data kampus, dan bukti
              kepemilikan untuk pemeriksaan manual terhadap PDDikti. Bukti
              disimpan sementara dan dijadwalkan untuk dihapus.
            </p>
            <p className="mt-3">
              Verifikasi bersifat opsional dan badge tidak menjamin perilaku
              atau keamanan pengguna.
            </p>
          </div>
          <label className="mt-6 flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-5 w-5 accent-brand-blue" />
            <span className="text-sm leading-6">Saya memahami tujuan, data yang diproses, pemeriksaan manual, serta retensi dan penghapusan bukti.</span>
          </label>
        </fieldset>
      ) : null}

      <p className="mt-6 text-sm leading-6 text-brand-error" aria-live="assertive">
        {message}
      </p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <button type="button" onClick={() => setStep((current) => Math.max(current - 1, 0))} disabled={step === 0 || isBusy} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-border px-5 font-semibold disabled:invisible">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali
        </button>
        {step < 2 ? (
          <button type="button" onClick={nextStep} className="focus-ring inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand-blue px-5 font-semibold text-white">
            Lanjutkan <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button type="submit" disabled={isBusy} className="focus-ring min-h-12 rounded-xl bg-brand-blue px-6 font-semibold text-white disabled:opacity-60">
            {isBusy ? "Mengirim…" : "Kirim untuk diperiksa"}
          </button>
        )}
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  onChange,
  className = "",
  ...props
}: {
  id: string;
  label: string;
  onChange: (value: string) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "onChange">) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="text-sm font-semibold">{label}</span>
      <input
        id={id}
        required
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring mt-2 h-12 w-full rounded-xl border border-brand-border px-4"
        {...props}
      />
    </label>
  );
}
