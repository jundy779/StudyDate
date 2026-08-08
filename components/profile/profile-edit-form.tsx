"use client";

import { saveStudentProfile } from "@/app/app/profile/actions";
import { PeopleProfileCard } from "@/components/people/people-profile-card";
import { CONNECTION_GOALS, INTERESTS } from "@/lib/onboarding/constants";
import type { DiscoveryProfile } from "@/lib/people/service";
import {
  countCompletedProfileItems,
  getProfileCompletenessItems,
} from "@/lib/profile/completeness";
import type { EditableStudentProfile } from "@/lib/profile/validation";
import {
  mascotImageSrc,
  PROFILE_MASCOT_OPTIONS,
  type ProfileMascot,
} from "@/lib/profile/validation";
import { CheckCircle2, Circle } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

const DEGREE_OPTIONS = [
  ["diploma", "Diploma"],
  ["sarjana", "Sarjana"],
  ["magister", "Magister"],
  ["doktor", "Doktor"],
  ["profesi", "Profesi"],
  ["spesialis", "Spesialis"],
] as const;

const MASCOT_LABEL: Record<ProfileMascot, string> = {
  front: "Depan",
  hello: "Halo",
  chat: "Chat",
  study: "Belajar",
};

type ProfileEditFormProps = {
  profile: EditableStudentProfile;
};

function SelectionChip({
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
      className={`focus-ring min-h-10 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors ${
        selected
          ? "border-brand-blue bg-brand-blue text-white"
          : "border-brand-border bg-white text-brand-navy hover:border-brand-blue"
      }`}
    >
      {label}
    </button>
  );
}

function toggleInList(values: string[], value: string, max: number) {
  if (values.includes(value)) {
    return values.filter((item) => item !== value);
  }
  if (values.length >= max) {
    return values;
  }
  return [...values, value];
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-brand-border bg-white p-4 sm:p-5">
      <h2 className="font-heading text-lg font-semibold text-brand-navy sm:text-xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-1.5 text-sm leading-6 text-brand-muted">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ProfileEditForm({ profile }: ProfileEditFormProps) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [mascot, setMascot] = useState<ProfileMascot>(
    (PROFILE_MASCOT_OPTIONS.includes(profile.avatarMascot as ProfileMascot)
      ? profile.avatarMascot
      : "front") as ProfileMascot,
  );
  const [discoverable, setDiscoverable] = useState(profile.isDiscoverable);
  const [interests, setInterests] = useState(profile.interests);
  const [connectionGoals, setConnectionGoals] = useState(
    profile.connectionGoals,
  );
  const [cityRegion, setCityRegion] = useState(profile.cityRegion ?? "");
  const [shortIntro, setShortIntro] = useState(profile.shortIntro ?? "");
  const [studyProgram, setStudyProgram] = useState(profile.studyProgram);
  const [campus, setCampus] = useState(profile.campus);
  const [semester, setSemester] = useState(
    profile.semester != null ? String(profile.semester) : "",
  );
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl ?? "");
  const [instagramUsername, setInstagramUsername] = useState(
    profile.instagramUsername ?? "",
  );

  const completeness = useMemo(
    () =>
      getProfileCompletenessItems({
        firstName: profile.firstName,
        lastName: profile.lastName,
        campus,
        studyProgram,
        cityRegion,
        shortIntro,
        interests,
        connectionGoals,
        avatarMascot: mascot,
        isDiscoverable: discoverable,
        linkedinUrl,
        instagramUsername,
      }),
    [
      profile.firstName,
      profile.lastName,
      campus,
      studyProgram,
      cityRegion,
      shortIntro,
      interests,
      connectionGoals,
      mascot,
      discoverable,
      linkedinUrl,
      instagramUsername,
    ],
  );
  const completedCount = countCompletedProfileItems(completeness);
  const incompleteItems = completeness.filter((item) => !item.done);
  const previewProfile: DiscoveryProfile = {
    public_alias: profile.publicAlias,
    campus,
    study_program: studyProgram,
    semester: semester === "" ? null : Number(semester),
    city_region: cityRegion.trim() || null,
    short_intro: shortIntro.trim() || null,
    interests,
    connection_goals: connectionGoals,
    is_verified: profile.verificationStatus === "verified",
  };
  const previewMascot =
    mascotImageSrc(mascot) ?? `/brand/mascot/${mascot}.png`;

  function onSubmit(formData: FormData) {
    formData.set("avatarMascot", mascot);
    formData.set("isDiscoverable", discoverable ? "true" : "false");
    formData.delete("interests");
    formData.delete("connectionGoals");
    for (const value of interests) {
      formData.append("interests", value);
    }
    for (const value of connectionGoals) {
      formData.append("connectionGoals", value);
    }
    setMessage("");
    setError("");
    startTransition(async () => {
      const result = await saveStudentProfile(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage("Profil tersimpan.");
    });
  }

  const sidebar = (
    <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
      <section className="overflow-hidden rounded-[20px] border border-brand-border bg-[linear-gradient(135deg,#eef4ff_0%,#ffffff_60%)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-end justify-center overflow-hidden rounded-2xl border border-white bg-white/80">
            <Image
              src={previewMascot}
              alt=""
              width={64}
              height={64}
              className="h-[90%] w-[90%] object-contain object-bottom"
            />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-blue">
              Profil anonim
            </p>
            <p className="mt-1 truncate font-heading text-lg font-semibold text-brand-navy">
              {profile.publicAlias}
            </p>
            <p className="mt-1 truncate text-xs text-brand-muted">
              {discoverable ? "Tampil di People" : "Disembunyikan"}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[20px] border border-brand-border bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-base font-semibold text-brand-navy">
            Kelengkapan
          </h2>
          <p className="text-sm font-semibold text-brand-blue">
            {completedCount}/{completeness.length}
          </p>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-surface">
          <div
            className="h-full rounded-full bg-brand-blue transition-[width]"
            style={{
              width: `${Math.round((completedCount / completeness.length) * 100)}%`,
            }}
          />
        </div>
        {incompleteItems.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {incompleteItems.slice(0, 5).map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 text-xs text-brand-muted"
              >
                <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {item.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Profil sudah lengkap
          </p>
        )}
      </section>

      <section className="rounded-[20px] border border-brand-border bg-white p-4">
        <h2 className="font-heading text-base font-semibold text-brand-navy">
          Pratinjau People
        </h2>
        <p className="mt-1 text-xs leading-5 text-brand-muted">
          Kartu anonim yang orang lain lihat.
        </p>
        <div className="mt-3">
          <PeopleProfileCard
            profile={previewProfile}
            mascotSrc={previewMascot}
            hideCta
          />
        </div>
        {!discoverable ? (
          <p className="mt-3 text-xs font-semibold text-amber-800">
            Saat ini disembunyikan dari People.
          </p>
        ) : null}
      </section>
    </aside>
  );

  return (
    <form
      action={onSubmit}
      className="mt-6 grid gap-5 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,340px)] lg:items-start lg:gap-8"
    >
      <div className="order-2 space-y-4 lg:order-1 lg:space-y-5">
        <Section
          title="Data diri"
          description={`Nama lengkap privat. Di People orang lain melihat ${profile.publicAlias}.`}
        >
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <label className="text-sm font-semibold">
              Nama depan
              <input
                name="firstName"
                required
                maxLength={80}
                defaultValue={profile.firstName}
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-brand-border px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Nama belakang
              <input
                name="lastName"
                required
                maxLength={80}
                defaultValue={profile.lastName ?? ""}
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-brand-border px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Kampus
              <input
                name="campus"
                required
                maxLength={120}
                value={campus}
                onChange={(event) => setCampus(event.target.value)}
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-brand-border px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Program studi
              <input
                name="studyProgram"
                required
                maxLength={120}
                value={studyProgram}
                onChange={(event) => setStudyProgram(event.target.value)}
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-brand-border px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Jenjang
              <select
                name="degreeLevel"
                defaultValue={profile.degreeLevel}
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-brand-border px-3 font-normal"
              >
                {DEGREE_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Semester{" "}
              <span className="font-normal text-brand-muted">(opsional)</span>
              <select
                name="semester"
                value={semester}
                onChange={(event) => setSemester(event.target.value)}
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-brand-border px-3 font-normal"
              >
                <option value="">Belum dipilih</option>
                {Array.from({ length: 16 }, (_, index) => index + 1).map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Kota / wilayah{" "}
              <span className="font-normal text-brand-muted">(opsional)</span>
              <input
                name="cityRegion"
                maxLength={120}
                value={cityRegion}
                onChange={(event) => setCityRegion(event.target.value)}
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-brand-border px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold sm:col-span-2">
              Intro singkat{" "}
              <span className="font-normal text-brand-muted">(opsional)</span>
              <textarea
                name="shortIntro"
                maxLength={300}
                rows={2}
                value={shortIntro}
                onChange={(event) => setShortIntro(event.target.value)}
                className="focus-ring mt-1.5 w-full rounded-xl border border-brand-border px-3 py-2 font-normal"
              />
            </label>
          </div>
        </Section>

        <Section
          title="Kontak Mutual Reveal"
          description="LinkedIn wajib untuk People. Instagram opsional. Privat — baru dibagikan setelah Contact Reveal dua arah."
        >
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
            <label className="text-sm font-semibold">
              LinkedIn{" "}
              <span className="font-normal text-brand-error">(wajib)</span>
              <input
                name="linkedinUrl"
                required
                value={linkedinUrl}
                onChange={(event) => setLinkedinUrl(event.target.value)}
                placeholder="https://www.linkedin.com/in/namamu"
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-brand-border px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold">
              Instagram{" "}
              <span className="font-normal text-brand-muted">(opsional)</span>
              <input
                name="instagramUsername"
                value={instagramUsername}
                onChange={(event) => setInstagramUsername(event.target.value)}
                placeholder="@username"
                className="focus-ring mt-1.5 h-11 w-full rounded-xl border border-brand-border px-3 font-normal"
              />
            </label>
          </div>
          {!linkedinUrl.trim() && discoverable ? (
            <p className="mt-3 text-sm font-semibold text-amber-800">
              People butuh LinkedIn. Isi URL-nya, atau nonaktifkan visibilitas.
            </p>
          ) : null}
        </Section>

        <Section
          title="Tujuan & minat"
          description="Pilih 1–6 untuk masing-masing."
        >
          <fieldset>
            <legend className="text-sm font-semibold text-brand-navy">
              Tujuan koneksi
            </legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {CONNECTION_GOALS.map((goal) => (
                <SelectionChip
                  key={goal.value}
                  label={goal.label}
                  selected={connectionGoals.includes(goal.value)}
                  onChange={() =>
                    setConnectionGoals((current) =>
                      toggleInList(current, goal.value, 6),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-4">
            <legend className="text-sm font-semibold text-brand-navy">
              Minat
            </legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {INTERESTS.map((interest) => (
                <SelectionChip
                  key={interest.value}
                  label={interest.label}
                  selected={interests.includes(interest.value)}
                  onChange={() =>
                    setInterests((current) =>
                      toggleInList(current, interest.value, 6),
                    )
                  }
                />
              ))}
            </div>
          </fieldset>
        </Section>

        <Section
          title="Avatar & visibilitas"
          description="Maskot untuk People. Foto wajah hanya lewat Identity Reveal di percakapan."
        >
          <div className="grid grid-cols-4 gap-2 sm:gap-3">
            {PROFILE_MASCOT_OPTIONS.map((key) => {
              const selected = mascot === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setMascot(key)}
                  className={`focus-ring rounded-xl border p-2 text-center sm:rounded-2xl sm:p-3 ${
                    selected
                      ? "border-brand-blue bg-brand-surface"
                      : "border-brand-border bg-white"
                  }`}
                >
                  <Image
                    src={`/brand/mascot/${key}.png`}
                    alt=""
                    width={96}
                    height={96}
                    className="mx-auto h-14 w-auto object-contain sm:h-20"
                  />
                  <span className="mt-1 block text-[11px] font-semibold sm:mt-2 sm:text-sm">
                    {MASCOT_LABEL[key]}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-xs leading-5 text-brand-muted">
            Upload foto wajah saat Identity Reveal di{" "}
            <Link
              href="/app/messages"
              className="font-semibold text-brand-blue underline-offset-2 hover:underline"
            >
              Pesan
            </Link>
            .
          </p>
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-brand-border bg-brand-surface/50 px-3 py-3">
            <input
              type="checkbox"
              checked={discoverable}
              onChange={(event) => setDiscoverable(event.target.checked)}
              className="mt-0.5 h-5 w-5 accent-brand-blue"
            />
            <span>
              <span className="block text-sm font-semibold text-brand-navy">
                Tampilkan profil anonim di People
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-brand-muted">
                Butuh LinkedIn. Tanpa nama lengkap, foto wajah, atau kontak.
              </span>
            </span>
          </label>
        </Section>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-brand-error">
            {error}
          </p>
        ) : null}
        {message ? (
          <p role="status" className="text-sm font-semibold text-emerald-700">
            {message}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 lg:sticky lg:bottom-4 lg:z-10 lg:rounded-2xl lg:border lg:border-brand-border lg:bg-white/95 lg:p-3 lg:shadow-[0_8px_24px_rgba(15,27,51,0.08)] lg:backdrop-blur">
          <button
            type="submit"
            disabled={isPending}
            className="focus-ring min-h-12 rounded-xl bg-brand-blue px-6 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isPending ? "Menyimpan…" : "Simpan profil"}
          </button>
          <p className="text-xs text-brand-muted lg:hidden">
            Pratinjau ada di bawah pada layar kecil.
          </p>
        </div>
      </div>

      <div className="order-1 lg:order-2">{sidebar}</div>
    </form>
  );
}
