"use client";

import {
  SearchableCreatableCombobox,
  type ComboboxEntryMode,
} from "@/components/onboarding/searchable-creatable-combobox";
import { CAMPUS_OPTIONS } from "@/lib/onboarding/options/campuses";
import { STUDY_PROGRAM_OPTIONS } from "@/lib/onboarding/options/study-programs";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileImage,
  LockKeyhole,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { useState, type FormEvent } from "react";

type AcademicData = {
  nim: string;
  legalName: string;
  campus: string;
  studyProgram: string;
  degreeLevel: string;
  semester: string;
};

const initialAcademicData: AcademicData = {
  nim: "",
  legalName: "",
  campus: "",
  studyProgram: "",
  degreeLevel: "",
  semester: "",
};

const MAX_EVIDENCE_BYTES = 5_242_880;
const SUPPORTED_EVIDENCE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

type LookupOutcome =
  | "idle"
  | "academic_match"
  | "not_found"
  | "mismatch"
  | "provider_unavailable"
  | "provider_invalid_response";

export function VerificationForm({
  capabilities,
  matchedRequestId,
}: {
  capabilities: {
    manualCard: boolean;
    manualEmail: boolean;
    provider: boolean;
  };
  matchedRequestId?: string;
}) {
  const [step, setStep] = useState(matchedRequestId ? 1 : 0);
  const [academic, setAcademic] = useState(initialAcademicData);
  const [method, setMethod] = useState<"campus_email" | "student_card">(
    capabilities.manualEmail ? "campus_email" : "student_card",
  );
  const [campusEmail, setCampusEmail] = useState("");
  const [studentCardEvidence, setStudentCardEvidence] = useState<File | null>(
    null,
  );
  const [pddiktiEvidence, setPddiktiEvidence] = useState<File | null>(null);
  const [campusMode, setCampusMode] = useState<ComboboxEntryMode>("list");
  const [studyProgramMode, setStudyProgramMode] =
    useState<ComboboxEntryMode>("list");
  const [consent, setConsent] = useState(false);
  const [providerConsent, setProviderConsent] = useState(false);
  const [requestId, setRequestId] = useState(matchedRequestId ?? "");
  const [lookupOutcome, setLookupOutcome] = useState<LookupOutcome>(
    matchedRequestId ? "academic_match" : "idle",
  );
  const [manualFlow, setManualFlow] = useState(!capabilities.provider);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"info" | "error">("info");
  const [isBusy, setIsBusy] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  function updateAcademic(field: keyof AcademicData, value: string) {
    setAcademic((current) => ({ ...current, [field]: value }));
    setLookupOutcome("idle");
    setRequestId("");
    setManualFlow(!capabilities.provider);
    setMessage("");
    setMessageTone("info");
  }

  function nextStep() {
    setMessage("");
    setMessageTone("info");
    if (
      step === 0 &&
      (!academic.nim.trim() ||
        !academic.legalName.trim() ||
        !academic.campus.trim() ||
        !academic.studyProgram.trim() ||
        !academic.degreeLevel)
    ) {
      setMessage(
        "Lengkapi data akademik sebelum melakukan pemeriksaan.",
      );
      setMessageTone("error");
      return;
    }
    if (step === 0 && lookupOutcome !== "academic_match" && !manualFlow) {
      setMessage("Periksa data akademik atau lanjutkan dengan mengunggah bukti.");
      setMessageTone("error");
      return;
    }
    if (step === 0 && manualFlow && !pddiktiEvidence) {
      setMessage("Unggah tangkapan layar PDDIKTI agar dapat diperiksa petugas.");
      setMessageTone("error");
      return;
    }
    if (
      step === 0 &&
      pddiktiEvidence &&
      (pddiktiEvidence.size > MAX_EVIDENCE_BYTES ||
        !SUPPORTED_EVIDENCE_TYPES.includes(pddiktiEvidence.type))
    ) {
      setMessage("Bukti PDDikti harus berupa JPG, PNG, atau WebP maksimal 5 MB.");
      setMessageTone("error");
      return;
    }
    if (step === 1) {
      if (method === "campus_email" && !campusEmail.trim()) {
        setMessage("Masukkan email kampus sebelum melanjutkan.");
        setMessageTone("error");
        return;
      }
      if (method === "student_card" && !studentCardEvidence) {
        setMessage("Pilih foto kartu mahasiswa sebelum melanjutkan.");
        setMessageTone("error");
        return;
      }
      if (
        method === "student_card" &&
        studentCardEvidence &&
        (studentCardEvidence.size > MAX_EVIDENCE_BYTES ||
          !SUPPORTED_EVIDENCE_TYPES.includes(studentCardEvidence.type))
      ) {
        setMessage("Foto kartu mahasiswa harus berupa JPG, PNG, atau WebP maksimal 5 MB.");
        setMessageTone("error");
        return;
      }
    }
    setStep((current) => Math.min(current + 1, 2));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!consent) {
      setMessage("Persetujuan verifikasi harus diberikan secara terpisah.");
      setMessageTone("error");
      return;
    }
    setIsBusy(true);
    setMessage("");
    setMessageTone("info");
    const body = new FormData();
    if (manualFlow) {
      Object.entries(academic).forEach(([key, value]) => body.set(key, value));
    }
    body.set("method", method);
    body.set("consent", "true");
    body.set(
      "flow",
      manualFlow || lookupOutcome !== "academic_match"
        ? "manual"
        : "academic_matched",
    );
    body.set("requestId", requestId);
    if (pddiktiEvidence) body.set("pddiktiEvidence", pddiktiEvidence);
    if (studentCardEvidence) {
      body.set("studentCardEvidence", studentCardEvidence);
    }

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
        setMessageTone("error");
        return;
      }
      setRequestId(result.requestId);
      if (method === "student_card") {
        setIsComplete(true);
        setMessage("Bukti terkirim dan akan diperiksa oleh petugas.");
      } else {
        setMessage(
          "Permintaan tersimpan. Kirim kode ke email kampus untuk membuktikan kepemilikan.",
        );
      }
    } catch {
      setMessage("Permintaan verifikasi belum dapat dikirim. Coba lagi.");
      setMessageTone("error");
    } finally {
      setIsBusy(false);
    }
  }

  async function lookupAcademicData() {
    if (!providerConsent) {
      setMessage(
        "Berikan persetujuan pencocokan melalui layanan data akademik eksternal sebelum memeriksa data.",
      );
      setMessageTone("error");
      return;
    }
    setIsBusy(true);
    setMessage("Memeriksa data akademik...");
    setMessageTone("info");
    try {
      const response = await fetch("/api/verification/academic-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...academic, providerConsent: "true" }),
      });
      const result = (await response.json()) as {
        outcome?: LookupOutcome;
        requestId?: string;
        message?: string;
      };
      if (!response.ok || !result.outcome) {
        setMessage(result.message ?? "Data akademik belum dapat diperiksa.");
        setMessageTone("error");
        return;
      }
      setLookupOutcome(result.outcome);
      setRequestId(result.requestId ?? "");
      setManualFlow(false);
      setMessageTone(
        result.outcome === "academic_match" ||
          result.outcome === "not_found" ||
          result.outcome === "mismatch"
          ? "info"
          : "error",
      );
      setMessage(
        result.outcome === "academic_match"
          ? "Data akademik ditemukan."
          : result.outcome === "not_found"
            ? "Data mahasiswa belum berhasil ditemukan."
            : result.outcome === "mismatch"
              ? "Data yang ditemukan belum cocok dengan informasi yang kamu masukkan."
              : "Layanan pengecekan akademik sedang tidak tersedia.",
      );
    } catch {
      setMessage("Layanan pengecekan akademik sedang tidak tersedia.");
      setLookupOutcome("provider_unavailable");
      setMessageTone("error");
    } finally {
      setIsBusy(false);
    }
  }

  async function sendCode() {
    setIsBusy(true);
    setMessage("");
    setMessageTone("info");
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
      setMessageTone(response.ok ? "info" : "error");
    } catch {
      setMessage("Kode belum dapat dikirim. Coba lagi.");
      setMessageTone("error");
    } finally {
      setIsBusy(false);
    }
  }

  async function confirmCode() {
    setIsBusy(true);
    setMessage("");
    setMessageTone("info");
    try {
      const response = await fetch("/api/verification/campus-email/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId, code }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setMessage(result.message ?? "Kode belum dapat dikonfirmasi.");
        setMessageTone("error");
        return;
      }
      setIsComplete(true);
      setMessage(
        "Email kampus terkonfirmasi. Petugas akan memberi keputusan akhir setelah memeriksa seluruh bukti.",
      );
    } catch {
      setMessage("Kode belum dapat dikonfirmasi. Coba lagi.");
      setMessageTone("error");
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
          {message} Tanda verifikasi hanya diberikan setelah data akademik dan bukti
          kepemilikan selesai diperiksa oleh petugas.
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
            Verifikasi data akademik
          </legend>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-brand-muted">
            Cocokkan isian dengan data PDDikti. Nama lengkap dan NIM tetap
            privat dan tidak ditampilkan pada profil publik.
          </p>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <Field
              id="legal-name"
              label="Nama lengkap sesuai PDDikti"
              value={academic.legalName}
              maxLength={160}
              autoComplete="name"
              onChange={(value) => updateAcademic("legalName", value)}
            />
            <Field
              id="verification-nim"
              label="NIM"
              value={academic.nim}
              maxLength={32}
              autoComplete="off"
              helperText="Digunakan hanya untuk pencocokan data mahasiswa."
              errorText={message && !academic.nim.trim() ? message : undefined}
              onChange={(value) => updateAcademic("nim", value)}
            />
            <SearchableCreatableCombobox
              id="verification-campus"
              label="Kampus / Universitas"
              value={academic.campus}
              options={CAMPUS_OPTIONS}
              placeholder="Cari kampus atau universitas..."
              noResultsPrompt="Kampusmu belum ada di daftar?"
              manualButtonLabel="Tambahkan kampus secara manual"
              manualLabel="Nama kampus / universitas"
              manualPlaceholder="Tulis nama kampusmu"
              mode={campusMode}
              helperText="Pilih dari daftar atau masukkan nama kampus secara manual."
              autoComplete="organization"
              maxLength={120}
              onChange={(value) => updateAcademic("campus", value)}
              onModeChange={setCampusMode}
            />
            <SearchableCreatableCombobox
              id="verification-program"
              label="Program studi / jurusan"
              value={academic.studyProgram}
              options={STUDY_PROGRAM_OPTIONS}
              placeholder="Cari program studi..."
              noResultsPrompt="Program studimu belum ada di daftar?"
              manualButtonLabel="Tambahkan program studi secara manual"
              manualLabel="Nama program studi / jurusan"
              manualPlaceholder="Tulis program studimu"
              mode={studyProgramMode}
              maxLength={120}
              onChange={(value) => updateAcademic("studyProgram", value)}
              onModeChange={setStudyProgramMode}
            />
            <label className="block min-w-0">
              <span className="text-sm font-semibold">Jenjang</span>
              <select
                id="verification-degree-level"
                value={academic.degreeLevel}
                required
                onChange={(event) =>
                  updateAcademic("degreeLevel", event.target.value)
                }
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
            <label className="block min-w-0">
              <span className="text-sm font-semibold">
                Semester{" "}
                <span className="font-normal text-brand-muted">(opsional)</span>
              </span>
              <select
                id="verification-semester"
                value={academic.semester}
                onChange={(event) =>
                  updateAcademic("semester", event.target.value)
                }
                className="focus-ring mt-2 h-12 w-full rounded-xl border border-brand-border bg-white px-4"
              >
                <option value="">Pilih semester</option>
                {Array.from({ length: 16 }, (_, index) => index + 1).map(
                  (semester) => (
                    <option key={semester} value={semester}>
                      Semester {semester}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          {capabilities.provider ? (
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={isBusy}
              onClick={lookupAcademicData}
              className="focus-ring min-h-12 rounded-xl bg-brand-blue px-5 font-semibold text-white disabled:opacity-60"
            >
              {isBusy ? "Memeriksa data akademik..." : "Periksa data akademik"}
            </button>
            {["not_found", "mismatch", "provider_unavailable", "provider_invalid_response"].includes(lookupOutcome) ? (
              <button
                type="button"
                onClick={() => {
                  setManualFlow(true);
                  setMessage("Isi data akademikmu dan unggah tangkapan layar PDDIKTI agar petugas dapat memeriksanya.");
                  setMessageTone("info");
                }}
                className="focus-ring min-h-12 rounded-xl border border-brand-border px-5 font-semibold"
              >
                Lanjutkan dengan unggah bukti
              </button>
            ) : null}
          </div>
          ) : (
            <p className="mt-7 rounded-xl border border-brand-border bg-brand-surface p-4 text-sm leading-6 text-brand-muted">
              Pemeriksaan otomatis belum tersedia pada tahap uji ini. Unggah
              tangkapan layar PDDIKTI agar data akademikmu dapat diperiksa petugas.
            </p>
          )}
          {capabilities.provider ? (
          <label className="mt-5 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={providerConsent}
              onChange={(event) => setProviderConsent(event.target.checked)}
              className="mt-1 h-5 w-5 accent-brand-blue"
            />
            <span className="text-sm leading-6 text-brand-muted">
              Saya setuju StudyDate mengirim NIM, nama lengkap resmi, kampus, dan program
              studi yang saya isi ke layanan data akademik eksternal hanya untuk
              pencocokan verifikasi ini.
            </span>
          </label>
          ) : null}
          <p
            className={`mt-4 text-sm leading-6 ${
              messageTone === "error" ? "text-brand-error" : "text-brand-muted"
            }`}
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
          {manualFlow ? (
          <div className="mt-7 rounded-[20px] border border-brand-border bg-brand-surface/60 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand-blue shadow-sm">
                <UploadCloud className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-semibold">
                  Tangkapan layar PDDIKTI
                </h3>
                <p className="mt-1 text-sm leading-6 text-brand-muted">
                  Unggah tangkapan layar halaman PDDIKTI yang menampilkan data
                  akademik yang ingin kamu verifikasi.
                </p>
              </div>
            </div>
            <label
              htmlFor="pddikti-evidence"
              className="focus-within:outline-brand-blue mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-brand-blue/45 bg-white px-5 py-6 text-center focus-within:outline focus-within:outline-2 focus-within:outline-offset-4"
            >
              {pddiktiEvidence ? (
                <>
                  <FileImage
                    className="h-7 w-7 text-brand-blue"
                    aria-hidden="true"
                  />
                  <span className="mt-3 max-w-full truncate text-sm font-semibold text-brand-navy">
                    {pddiktiEvidence.name}
                  </span>
                  <span className="mt-1 text-xs text-brand-muted">
                    Klik untuk mengganti file
                  </span>
                </>
              ) : (
                <>
                  <UploadCloud
                    className="h-7 w-7 text-brand-blue"
                    aria-hidden="true"
                  />
                  <span className="mt-3 text-sm font-semibold text-brand-navy">
                    Pilih tangkapan layar PDDIKTI
                  </span>
                  <span className="mt-1 text-xs text-brand-muted">
                    JPG, PNG, atau WebP · maksimal 5 MB
                  </span>
                </>
              )}
              <input
                id="pddikti-evidence"
                type="file"
                required
                accept="image/jpeg,image/png,image/webp"
                aria-describedby="pddikti-evidence-privacy"
                onChange={(event) => {
                  setPddiktiEvidence(event.target.files?.[0] ?? null);
                  setMessage("");
                  setMessageTone("info");
                }}
                className="sr-only"
              />
            </label>
            <p
              id="pddikti-evidence-privacy"
              className="mt-4 flex items-start gap-2 text-xs leading-5 text-brand-muted"
            >
              <LockKeyhole
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue"
                aria-hidden="true"
              />
              Pastikan tangkapan layar hanya memuat informasi yang diperlukan.
              Hindari menyertakan data lain yang tidak berkaitan dengan verifikasi.
              Bukti ini hanya mendukung pencocokan akademik, bukan bukti kepemilikan.
            </p>
          </div>
          ) : null}
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
              ...(capabilities.manualEmail
                ? [["campus_email", "Email kampus", "Kode ke domain kampus yang telah disetujui."]]
                : []),
              ...(capabilities.manualCard
                ? [["student_card", "Kartu mahasiswa", "Foto diperiksa petugas dan disimpan secara privat."]]
                : []),
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
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setStudentCardEvidence(event.target.files?.[0] ?? null)} className="focus-ring mt-2 block w-full rounded-xl border border-brand-border p-3 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-brand-surface file:px-4 file:py-2 file:font-semibold" />
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
              Proses ini menggunakan NIM, nama lengkap resmi, data kampus, dan bukti
              kepemilikan. Pencocokan otomatis dapat memakai layanan data
              akademik eksternal. Layanan tersebut tidak menerima akses ke profil publikmu.
              Bukti disimpan sementara dan dijadwalkan untuk dihapus.
            </p>
            <p className="mt-3">
              Verifikasi bersifat opsional dan tanda verifikasi tidak menjamin perilaku
              atau keamanan pengguna.
            </p>
          </div>
          <label className="mt-6 flex cursor-pointer items-start gap-3">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-5 w-5 accent-brand-blue" />
            <span className="text-sm leading-6">Saya memahami tujuan verifikasi, data yang digunakan, pemeriksaan oleh petugas, lama penyimpanan, dan penghapusan bukti.</span>
          </label>
        </fieldset>
      ) : null}

      <p
        className={`mt-6 text-sm leading-6 ${
          messageTone === "error" ? "text-brand-error" : "text-brand-muted"
        }`}
        aria-live={messageTone === "error" ? "assertive" : "polite"}
      >
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
  helperText,
  errorText,
  onChange,
  className = "",
  ...props
}: {
  id: string;
  label: string;
  helperText?: string;
  errorText?: string;
  onChange: (value: string) => void;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "onChange">) {
  return (
    <div className={`block min-w-0 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        required
        aria-describedby={
          [helperText ? `${id}-helper` : null, errorText ? `${id}-error` : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        aria-invalid={Boolean(errorText)}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring mt-2 h-12 w-full rounded-xl border border-brand-border px-4"
        {...props}
      />
      {helperText ? (
        <p
          id={`${id}-helper`}
          className="mt-2 text-xs leading-5 text-brand-muted"
        >
          {helperText}
        </p>
      ) : null}
      {errorText ? (
        <p id={`${id}-error`} className="mt-2 text-xs leading-5 text-brand-error">
          {errorText}
        </p>
      ) : null}
    </div>
  );
}
