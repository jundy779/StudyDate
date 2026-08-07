"use client";

import {
  CONNECTION_GOALS,
  INTERESTS,
} from "@/lib/onboarding/constants";
import { CAMPUS_OPTIONS } from "@/lib/onboarding/options/campuses";
import { CITY_REGENCY_OPTIONS } from "@/lib/onboarding/options/cities";
import { STUDY_PROGRAM_OPTIONS } from "@/lib/onboarding/options/study-programs";
import {
  SearchableCreatableCombobox,
  type ComboboxEntryMode,
} from "./searchable-creatable-combobox";
import { useState } from "react";

const STEP_TITLES = [
  "Ceritakan sedikit tentang dirimu",
  "Apa yang ingin kamu temukan?",
  "Pilih cara yang paling nyaman",
  "Privasi dan persetujuan",
] as const;

const SEMESTER_OPTIONS = Array.from({ length: 16 }, (_, index) => index + 1);
const DEGREE_OPTIONS = [
  ["diploma", "Diploma"],
  ["sarjana", "Sarjana"],
  ["magister", "Magister"],
  ["doktor", "Doktor"],
  ["profesi", "Profesi"],
  ["spesialis", "Spesialis"],
] as const;

type FormState = {
  firstName: string;
  nim: string;
  campus: string;
  studyProgram: string;
  degreeLevel: (typeof DEGREE_OPTIONS)[number][0] | "";
  semester: number | null;
  cityRegion: string | null;
  shortIntro: null;
  interests: string[];
  connectionGoals: string[];
  preferences: {
    onlineFirst: boolean;
    groupFirst: boolean;
    verifiedUsersOnly: boolean;
    sameCampusPreferred: boolean;
    crossCampusAllowed: boolean;
  };
  consents: {
    terms: boolean;
    privacy: boolean;
    communityGuidelines: boolean;
  };
};

type StepOneField =
  | "firstName"
  | "nim"
  | "campus"
  | "studyProgram"
  | "degreeLevel"
  | "semester"
  | "cityRegion";

type StepOneErrors = Partial<Record<StepOneField, string>>;

type StepOneEntryModes = {
  campus: ComboboxEntryMode;
  studyProgram: ComboboxEntryMode;
  cityRegion: ComboboxEntryMode;
};

const initialState: FormState = {
  firstName: "",
  nim: "",
  campus: "",
  studyProgram: "",
  degreeLevel: "",
  semester: null,
  cityRegion: null,
  shortIntro: null,
  interests: [],
  connectionGoals: [],
  preferences: {
    onlineFirst: true,
    groupFirst: false,
    verifiedUsersOnly: false,
    sameCampusPreferred: false,
    crossCampusAllowed: true,
  },
  consents: {
    terms: false,
    privacy: false,
    communityGuidelines: false,
  },
};

function SelectionButton({
  label,
  selected,
  onChange,
}: {
  label: string;
  selected: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onChange}
      className={`focus-ring min-h-11 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
        selected
          ? "border-brand-blue bg-brand-blue text-white"
          : "border-brand-border bg-white text-brand-navy hover:border-brand-blue"
      }`}
    >
      {label}
    </button>
  );
}
function PreferenceToggle({
  checked,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-4 rounded-2xl border border-brand-border p-4 sm:p-5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-brand-blue"
      />
      <span>
        <span className="block font-semibold text-brand-navy">{label}</span>
        <span className="mt-1 block text-sm leading-6 text-brand-muted">
          {description}
        </span>
      </span>
    </label>
  );
}

export function OnboardingForm() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialState);
  const [stepOneErrors, setStepOneErrors] = useState<StepOneErrors>({});
  const [stepOneEntryModes, setStepOneEntryModes] =
    useState<StepOneEntryModes>({
      campus: "list",
      studyProgram: "list",
      cityRegion: "list",
    });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateStepOneField<Field extends StepOneField>(
    field: Field,
    value: FormState[Field],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setStepOneErrors((current) => {
      if (!current[field]) {
        return current;
      }

      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
    setError("");
  }

  function updateStepOneEntryMode(
    field: keyof StepOneEntryModes,
    mode: ComboboxEntryMode,
  ) {
    setStepOneEntryModes((current) => ({ ...current, [field]: mode }));
  }

  function toggleList(
    field: "interests" | "connectionGoals",
    value: string,
    maximum: number,
  ) {
    setError("");
    setForm((current) => {
      const values = current[field];
      const updated = values.includes(value)
        ? values.filter((item) => item !== value)
        : values.length < maximum
          ? [...values, value]
          : values;
      return { ...current, [field]: updated };
    });
  }

  function validateCurrentStep() {
    if (step === 0) {
      const fieldErrors: StepOneErrors = {};
      const firstName = form.firstName.trim();
      const nim = form.nim.trim();
      const campus = form.campus.trim();
      const studyProgram = form.studyProgram.trim();
      const cityRegion = form.cityRegion?.trim() ?? "";

      if (!firstName) {
        fieldErrors.firstName = "Nama depan wajib diisi.";
      } else if (firstName.length > 80) {
        fieldErrors.firstName = "Nama depan maksimal 80 karakter.";
      }

      if (
        nim &&
        (nim.length < 4 ||
          nim.length > 32 ||
          !/^[A-Za-z0-9./-]+$/.test(nim) ||
          nim.replace(/[\s./-]+/g, "").length < 4)
      ) {
        fieldErrors.nim = "Periksa kembali format NIM.";
      }

      if (campus.length < 2) {
        fieldErrors.campus = "Pilih atau tulis nama kampus minimal 2 karakter.";
      } else if (campus.length > 120) {
        fieldErrors.campus = "Nama kampus maksimal 120 karakter.";
      }

      if (studyProgram.length < 2) {
        fieldErrors.studyProgram =
          "Pilih atau tulis program studi minimal 2 karakter.";
      } else if (studyProgram.length > 120) {
        fieldErrors.studyProgram = "Program studi maksimal 120 karakter.";
      }

      if (!form.degreeLevel) {
        fieldErrors.degreeLevel = "Pilih jenjang pendidikan.";
      }

      if (
        form.semester !== null &&
        (form.semester < 1 || form.semester > 16)
      ) {
        fieldErrors.semester = "Pilih semester antara 1 dan 16.";
      }

      if (cityRegion.length > 120) {
        fieldErrors.cityRegion = "Kota atau kabupaten maksimal 120 karakter.";
      }

      setStepOneErrors(fieldErrors);

      if (Object.keys(fieldErrors).length) {
        setError(
          "Lengkapi data akademik yang wajib dan periksa kembali isianmu.",
        );
        return false;
      }
    }

    if (
      step === 1 &&
      (form.connectionGoals.length < 1 ||
        form.connectionGoals.length > 6 ||
        form.interests.length < 1 ||
        form.interests.length > 6)
    ) {
      setError("Pilih setidaknya satu tujuan dan satu minat, maksimal enam.");
      return false;
    }

    if (
      step === 3 &&
      (!form.consents.terms ||
        !form.consents.privacy ||
        !form.consents.communityGuidelines)
    ) {
      setError("Setujui ketiga dokumen untuk melanjutkan.");
      return false;
    }

    setError("");
    return true;
  }

  function goForward() {
    if (validateCurrentStep()) {
      setStep((current) => Math.min(3, current + 1));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function submitOnboarding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateCurrentStep() || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(result.message ?? "Onboarding belum dapat disimpan.");
        if (response.status === 401) {
          window.location.assign("/login");
        }
        return;
      }

      window.location.assign("/app");
    } catch {
      setError("Koneksi terputus. Periksa jaringan dan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={submitOnboarding}>
      <div className="mb-8">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-semibold text-brand-blue">
            Langkah {step + 1} dari 4
          </span>
          <span className="text-brand-muted">{STEP_TITLES[step]}</span>
        </div>
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-brand-border"
          aria-hidden="true"
        >
          <div
            className="h-full rounded-full bg-brand-blue transition-[width] motion-reduce:transition-none"
            style={{ width: `${(step + 1) * 25}%` }}
          />
        </div>
      </div>

      <h1 className="font-heading text-3xl font-semibold leading-tight tracking-[-0.03em] text-brand-navy sm:text-4xl">
        {STEP_TITLES[step]}
      </h1>

      {step === 0 ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          <TextField
            id="first-name"
            label="Nama depan"
            value={form.firstName}
            required
            maxLength={80}
            autoComplete="given-name"
            error={stepOneErrors.firstName}
            onChange={(value) => updateStepOneField("firstName", value)}
          />
          <TextField
            id="nim"
            label="NIM"
            optional
            value={form.nim}
            maxLength={32}
            inputMode="text"
            autoComplete="off"
            helperText="Disimpan privat dan hanya digunakan untuk verifikasi mahasiswa."
            error={stepOneErrors.nim}
            onChange={(value) => updateStepOneField("nim", value)}
          />
          <SearchableCreatableCombobox
            id="campus"
            label="Kampus"
            value={form.campus}
            options={CAMPUS_OPTIONS}
            placeholder="Cari nama kampus..."
            noResultsPrompt="Kampusmu tidak ditemukan?"
            manualButtonLabel="Tambahkan kampus secara manual"
            manualLabel="Nama kampus"
            manualPlaceholder="Tulis nama kampusmu"
            mode={stepOneEntryModes.campus}
            error={stepOneErrors.campus}
            helperText="Pilih dari daftar atau tambahkan nama kampusmu."
            autoComplete="organization"
            maxLength={120}
            onChange={(value) => updateStepOneField("campus", value)}
            onModeChange={(mode) => updateStepOneEntryMode("campus", mode)}
          />
          <SearchableCreatableCombobox
            id="study-program"
            label="Program studi"
            value={form.studyProgram}
            options={STUDY_PROGRAM_OPTIONS}
            placeholder="Cari program studi..."
            noResultsPrompt="Program studimu tidak ditemukan?"
            manualButtonLabel="Tambahkan program studi secara manual"
            manualLabel="Nama program studi"
            manualPlaceholder="Tulis nama program studimu"
            mode={stepOneEntryModes.studyProgram}
            error={stepOneErrors.studyProgram}
            maxLength={120}
            onChange={(value) => updateStepOneField("studyProgram", value)}
            onModeChange={(mode) =>
              updateStepOneEntryMode("studyProgram", mode)
            }
          />
          <div className="min-w-0">
            <label
              htmlFor="degree-level"
              className="mb-2 block text-sm font-semibold"
            >
              Jenjang
            </label>
            <select
              id="degree-level"
              value={form.degreeLevel}
              onChange={(event) =>
                updateStepOneField(
                  "degreeLevel",
                  event.target.value as FormState["degreeLevel"],
                )
              }
              aria-invalid={Boolean(stepOneErrors.degreeLevel)}
              aria-describedby={
                stepOneErrors.degreeLevel ? "degree-level-error" : undefined
              }
              className="focus-ring h-12 w-full rounded-xl border border-brand-border bg-white px-4"
            >
              <option value="">Pilih jenjang</option>
              {DEGREE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {stepOneErrors.degreeLevel ? (
              <p
                id="degree-level-error"
                className="mt-2 text-sm text-brand-error"
              >
                {stepOneErrors.degreeLevel}
              </p>
            ) : null}
          </div>
          <div className="min-w-0">
            <label
              htmlFor="semester"
              className="mb-2 block text-sm font-semibold"
            >
              Semester <span className="font-normal text-brand-muted">(opsional)</span>
            </label>
            <select
              id="semester"
              value={form.semester ?? ""}
              onChange={(event) =>
                updateStepOneField(
                  "semester",
                  event.target.value
                    ? Number(event.target.value)
                    : null,
                )
              }
              aria-invalid={Boolean(stepOneErrors.semester)}
              aria-describedby={
                stepOneErrors.semester ? "semester-error" : undefined
              }
              className="focus-ring h-12 w-full rounded-xl border border-brand-border bg-white px-4"
            >
              <option value="">Pilih semester</option>
              {SEMESTER_OPTIONS.map((semester) => (
                <option key={semester} value={semester}>
                  Semester {semester}
                </option>
              ))}
            </select>
            {stepOneErrors.semester ? (
              <p
                id="semester-error"
                className="mt-2 text-sm text-brand-error"
              >
                {stepOneErrors.semester}
              </p>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <SearchableCreatableCombobox
              id="city-region"
              label="Kota/Kabupaten"
              optional
              value={form.cityRegion ?? ""}
              options={CITY_REGENCY_OPTIONS}
              placeholder="Cari kota atau kabupaten..."
              noResultsPrompt="Kota atau kabupatenmu tidak ditemukan?"
              manualButtonLabel="Tambahkan secara manual"
              manualLabel="Nama kota atau kabupaten"
              manualPlaceholder="Tulis nama kota atau kabupatenmu"
              mode={stepOneEntryModes.cityRegion}
              error={stepOneErrors.cityRegion}
              maxLength={120}
              autoComplete="address-level2"
              onChange={(value) =>
                updateStepOneField("cityRegion", value || null)
              }
              onModeChange={(mode) =>
                updateStepOneEntryMode("cityRegion", mode)
              }
            />
          </div>
          <p className="rounded-2xl bg-brand-surface p-4 text-sm leading-6 text-brand-muted sm:col-span-2">
            Nama depan belum ditampilkan kepada pengguna lain. Sebelum Identity
            Reveal, profilmu akan menggunakan alias anonim.
          </p>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="mt-8 space-y-8">
          <p className="leading-7 text-brand-muted">
            Pilihan ini membantu StudyDate memahami konteks koneksi yang kamu
            cari. Hubungan tetap berkembang berdasarkan percakapan dan
            persetujuan bersama.
          </p>
          <fieldset>
            <legend className="font-heading text-lg font-semibold">
              Tujuan koneksi
            </legend>
            <p className="mt-1 text-sm text-brand-muted">Pilih 1–6 pilihan.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {CONNECTION_GOALS.map((goal) => (
                <SelectionButton
                  key={goal.value}
                  label={goal.label}
                  selected={form.connectionGoals.includes(goal.value)}
                  onChange={() =>
                    toggleList("connectionGoals", goal.value, 6)
                  }
                />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="font-heading text-lg font-semibold">Minat</legend>
            <p className="mt-1 text-sm text-brand-muted">Pilih 1–6 pilihan.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {INTERESTS.map((interest) => (
                <SelectionButton
                  key={interest.value}
                  label={interest.label}
                  selected={form.interests.includes(interest.value)}
                  onChange={() => toggleList("interests", interest.value, 6)}
                />
              ))}
            </div>
          </fieldset>
        </div>
      ) : null}

      {step === 2 ? (
        <fieldset className="mt-8 space-y-3">
          <legend className="sr-only">Preferensi koneksi</legend>
          <p className="mb-5 leading-7 text-brand-muted">
            Preferensi ini membantu mengatur cara kamu memulai dan dapat diubah
            nanti.
          </p>
          <PreferenceToggle
            checked={form.preferences.onlineFirst}
            label="Mulai secara online lebih dulu"
            description="Prioritaskan percakapan online sebelum pertemuan di tempat umum."
            onChange={(checked) =>
              setForm({
                ...form,
                preferences: { ...form.preferences, onlineFirst: checked },
              })
            }
          />
          <PreferenceToggle
            checked={form.preferences.groupFirst}
            label="Lebih nyaman dari group lebih dulu"
            description="Mulai melalui konteks kelompok kecil di kampus."
            onChange={(checked) =>
              setForm({
                ...form,
                preferences: { ...form.preferences, groupFirst: checked },
              })
            }
          />
          <PreferenceToggle
            checked={form.preferences.verifiedUsersOnly}
            label="Utamakan pengguna terverifikasi"
            description="Utamakan interaksi dengan akun yang statusnya sudah terverifikasi."
            onChange={(checked) =>
              setForm({
                ...form,
                preferences: {
                  ...form.preferences,
                  verifiedUsersOnly: checked,
                },
              })
            }
          />
          <PreferenceToggle
            checked={form.preferences.sameCampusPreferred}
            label="Utamakan mahasiswa satu kampus"
            description="Berikan prioritas pada konteks kampus yang sama."
            onChange={(checked) =>
              setForm({
                ...form,
                preferences: {
                  ...form.preferences,
                  sameCampusPreferred: checked,
                },
              })
            }
          />
          <PreferenceToggle
            checked={form.preferences.crossCampusAllowed}
            label="Izinkan koneksi lintas kampus"
            description="Izinkan koneksi dengan mahasiswa dari kampus lain."
            onChange={(checked) =>
              setForm({
                ...form,
                preferences: {
                  ...form.preferences,
                  crossCampusAllowed: checked,
                },
              })
            }
          />
        </fieldset>
      ) : null}

      {step === 3 ? (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl bg-brand-surface p-5 text-sm leading-6 text-brand-muted">
            <p>
              Saya memahami bahwa identitas dan kontak pribadi dibuka secara
              bertahap dan setiap jenis kontak memerlukan persetujuan dua arah.
            </p>
            <p className="mt-3">
              Pertemuan offline hanya diperbolehkan di tempat umum. Rumah, kos,
              apartemen pribadi, hotel, kendaraan, ruangan pribadi, dan tempat
              sepi tidak diperbolehkan.
            </p>
          </div>
          <fieldset className="space-y-3">
            <legend className="font-heading text-lg font-semibold">
              Persetujuan wajib
            </legend>
            <ConsentCheckbox
              checked={form.consents.terms}
              label="Saya menyetujui Ketentuan"
              href="/terms"
              onChange={(checked) =>
                setForm({
                  ...form,
                  consents: { ...form.consents, terms: checked },
                })
              }
            />
            <ConsentCheckbox
              checked={form.consents.privacy}
              label="Saya menyetujui Kebijakan Privasi"
              href="/privacy"
              onChange={(checked) =>
                setForm({
                  ...form,
                  consents: { ...form.consents, privacy: checked },
                })
              }
            />
            <ConsentCheckbox
              checked={form.consents.communityGuidelines}
              label="Saya menyetujui Pedoman Komunitas"
              href="/community-guidelines"
              onChange={(checked) =>
                setForm({
                  ...form,
                  consents: {
                    ...form.consents,
                    communityGuidelines: checked,
                  },
                })
              }
            />
          </fieldset>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-6 text-sm leading-6 text-brand-error">
          {error}
        </p>
      ) : null}

      <div className="mt-9 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => {
              setError("");
              setStep((current) => current - 1);
            }}
            className="focus-ring min-h-12 rounded-xl border border-brand-border px-6 font-semibold"
          >
            Kembali
          </button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <button
            type="button"
            onClick={goForward}
            className="focus-ring min-h-12 rounded-xl bg-brand-blue px-7 font-semibold text-white"
          >
            Lanjutkan
          </button>
        ) : (
          <button
            type="submit"
            disabled={isSubmitting}
            className="focus-ring min-h-12 rounded-xl bg-brand-blue px-7 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Menyimpan..." : "Selesaikan Onboarding"}
          </button>
        )}
      </div>
    </form>
  );
}

function TextField({
  id,
  label,
  optional = false,
  error,
  helperText,
  onChange,
  ...inputProps
}: {
  id: string;
  label: string;
  optional?: boolean;
  error?: string;
  helperText?: string;
  onChange: (value: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const describedBy = [
    helperText ? helperId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="block min-w-0">
      <label htmlFor={id} className="mb-2 block text-sm font-semibold">
        {label}{" "}
        {optional ? (
          <span className="font-normal text-brand-muted">(opsional)</span>
        ) : null}
      </label>
      <input
        id={id}
        type="text"
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring h-12 w-full rounded-xl border border-brand-border px-4"
        {...inputProps}
      />
      {helperText ? (
        <p id={helperId} className="mt-2 text-xs leading-5 text-brand-muted">
          {helperText}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="mt-2 text-sm text-brand-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ConsentCheckbox({
  checked,
  label,
  href,
  onChange,
}: {
  checked: boolean;
  label: string;
  href: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-border p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-brand-blue"
        aria-label={label}
      />
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="focus-ring rounded-sm text-sm font-semibold text-brand-blue underline decoration-brand-blue/30 underline-offset-4"
      >
        {label}
        <span className="sr-only"> (dibuka di tab baru)</span>
      </a>
    </div>
  );
}
