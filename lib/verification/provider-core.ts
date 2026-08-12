import { z } from "zod";

export type AcademicLookupOutcome =
  | "academic_match"
  | "not_found"
  | "mismatch"
  | "provider_unavailable"
  | "provider_invalid_response";

export type AcademicLookupClaim = {
  nim: string;
  legalName: string;
  campus: string;
  studyProgram: string;
};

export type AcademicLookupResult = {
  outcome: AcademicLookupOutcome;
  candidateCount: number;
  exactMatchFound: boolean;
  schemaValid: boolean;
  academicStatusPresent: boolean;
  matchComponents: {
    nim: boolean;
    name: boolean;
    campus: boolean;
    program: boolean;
  } | null;
  latencyMs: number;
};

export interface AcademicLookupProvider {
  lookup(
    claim: AcademicLookupClaim,
    signal?: AbortSignal,
  ): Promise<AcademicLookupResult>;
}

export type AcademicCandidate = {
  nim: string;
  name: string;
  campus: string;
  program: string;
  campusShortName?: string;
  level?: string;
  academicStatus?: string;
  campusCode?: string;
  programCode?: string;
};

const listCandidateSchema = z
  .object({
    nama: z.string().min(1).max(200),
    nim: z.string().min(1).max(32),
    nama_pt: z.string().min(1).max(200),
    singkatan_pt: z.string().max(80).optional(),
    sinkatan_pt: z.string().max(80).optional(),
    nama_prodi: z.string().min(1).max(200),
  })
  .passthrough();

const detailSchema = z
  .object({
    nama: z.string().min(1).max(200),
    nim: z.string().min(1).max(32),
    nama_pt: z.string().min(1).max(200),
    prodi: z.string().min(1).max(200),
    kode_pt: z.string().max(80).nullish(),
    kode_prodi: z.string().max(80).nullish(),
    jenjang: z.string().max(80).nullish(),
    status_saat_ini: z.string().max(120).nullish(),
  })
  .passthrough();

const responseSchema = z
  .object({
    status: z.literal(true),
    creator: z.string().optional(),
    result: z.object({
      endpoint: z.string().optional(),
      query: z.string().optional(),
      list: z.array(z.unknown()),
      details: z.array(z.unknown()).optional(),
    }),
  })
  .passthrough();

export function normalizeAcademicText(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("id-ID");
}

export function normalizeProviderNim(value: string) {
  // Preserve leading zeroes; separators follow the existing verification policy.
  return value.normalize("NFKC").trim().toUpperCase().replace(/[\s./-]+/g, "");
}

function normalizeAcademicLabel(value: string) {
  return normalizeAcademicText(value)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean)
    .join(" ");
}

export function normalizeCampusForMatch(value: string) {
  return normalizeAcademicLabel(value);
}

function campusesMatch(left: string, right: string) {
  return normalizeCampusForMatch(left) === normalizeCampusForMatch(right);
}

export function normalizeProgramForMatch(value: string) {
  return normalizeAcademicLabel(value);
}

function sameAcademicIdentity(
  candidate: AcademicCandidate,
  detail: z.infer<typeof detailSchema>,
) {
  return (
    normalizeProviderNim(candidate.nim) === normalizeProviderNim(detail.nim) &&
    normalizeAcademicText(candidate.name) === normalizeAcademicText(detail.nama) &&
    campusesMatch(candidate.campus, detail.nama_pt) &&
    normalizeProgramForMatch(candidate.program) ===
      normalizeProgramForMatch(detail.prodi)
  );
}

export function parseProviderCandidates(payload: unknown): {
  valid: boolean;
  candidates: AcademicCandidate[];
} {
  const root = responseSchema.safeParse(payload);
  if (!root.success) {
    return { valid: false, candidates: [] };
  }

  const candidates: AcademicCandidate[] = [];
  for (const raw of root.data.result.list.slice(0, 50)) {
    const parsed = listCandidateSchema.safeParse(raw);
    if (!parsed.success) continue;
    candidates.push({
      nim: parsed.data.nim,
      name: parsed.data.nama,
      campus: parsed.data.nama_pt,
      program: parsed.data.nama_prodi,
      campusShortName:
        parsed.data.sinkatan_pt?.trim() ||
        parsed.data.singkatan_pt?.trim() ||
        undefined,
    });
  }

  if (root.data.result.list.length > 0 && candidates.length === 0) {
    return { valid: false, candidates: [] };
  }

  const details = (root.data.result.details ?? [])
    .map((raw) => detailSchema.safeParse(raw))
    .filter((parsed) => parsed.success)
    .map((parsed) => parsed.data);
  for (const candidate of candidates) {
    const detail = details.find((entry) => sameAcademicIdentity(candidate, entry));
    if (!detail) continue;
    candidate.level = detail.jenjang?.trim() || undefined;
    candidate.academicStatus = detail.status_saat_ini?.trim() || undefined;
    candidate.campusCode = detail.kode_pt?.trim() || undefined;
    candidate.programCode = detail.kode_prodi?.trim() || undefined;
  }

  return { valid: true, candidates };
}

export function matchAcademicClaim(
  claim: AcademicLookupClaim,
  candidates: AcademicCandidate[],
): Pick<
  AcademicLookupResult,
  | "outcome"
  | "candidateCount"
  | "exactMatchFound"
  | "schemaValid"
  | "academicStatusPresent"
  | "matchComponents"
> {
  const normalizedNim = normalizeProviderNim(claim.nim);
  const sameNim = candidates.filter(
    (candidate) => normalizeProviderNim(candidate.nim) === normalizedNim,
  );
  if (!sameNim.length) {
    return {
      outcome: "not_found",
      candidateCount: candidates.length,
      exactMatchFound: false,
      schemaValid: true,
      academicStatusPresent: false,
      matchComponents: {
        nim: false,
        name: false,
        campus: false,
        program: false,
      },
    };
  }

  const name = normalizeAcademicText(claim.legalName);
  const program = normalizeProgramForMatch(claim.studyProgram);
  const matchComponents = {
    nim: true,
    name: sameNim.some((candidate) => normalizeAcademicText(candidate.name) === name),
    campus: sameNim.some(
      (candidate) =>
        campusesMatch(candidate.campus, claim.campus) ||
        (candidate.campusShortName
          ? campusesMatch(candidate.campusShortName, claim.campus)
          : false),
    ),
    program: sameNim.some(
      (candidate) => normalizeProgramForMatch(candidate.program) === program,
    ),
  };
  const exactCandidate = sameNim.find(
    (candidate) =>
      normalizeAcademicText(candidate.name) === name &&
      (campusesMatch(candidate.campus, claim.campus) ||
        (candidate.campusShortName
          ? campusesMatch(candidate.campusShortName, claim.campus)
          : false)) &&
      normalizeProgramForMatch(candidate.program) === program,
  );
  const exactMatchFound = Boolean(exactCandidate);

  return {
    outcome: exactMatchFound ? "academic_match" : "mismatch",
    candidateCount: candidates.length,
    exactMatchFound,
    schemaValid: true,
    academicStatusPresent: candidates.some((candidate) =>
      Boolean(candidate.academicStatus),
    ),
    matchComponents,
  };
}
