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
  latencyMs: number;
};

export interface AcademicLookupProvider {
  lookup(
    claim: AcademicLookupClaim,
    signal?: AbortSignal,
  ): Promise<AcademicLookupResult>;
}

type ProviderCandidate = {
  nama: string;
  nim: string;
  campuses: string[];
  programs: string[];
};

const candidateSchema = z
  .object({
    nama: z.string().min(1).max(200),
    nim: z.string().min(1).max(32),
    nama_pt: z.string().max(200).optional(),
    singkatan_pt: z.string().max(80).optional(),
    sinkatan_pt: z.string().max(80).optional(),
    nama_prodi: z.string().max(200).optional(),
    prodi: z.string().max(200).optional(),
  })
  .passthrough();

const recordSchema = z.record(z.string(), z.unknown());

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

export function normalizeProgramForMatch(value: string) {
  return normalizeAcademicLabel(value);
}

function candidateArrays(payload: unknown) {
  const root = recordSchema.safeParse(payload);
  if (!root.success || root.data.status !== true) return null;

  const containers = [root.data.result, root.data.data];
  for (const container of containers) {
    if (Array.isArray(container)) return container;
    const nested = recordSchema.safeParse(container);
    if (!nested.success) continue;
    for (const key of ["data", "result", "mahasiswa", "items", "list"]) {
      if (Array.isArray(nested.data[key])) return nested.data[key] as unknown[];
    }
  }
  return [];
}

export function parseProviderCandidates(payload: unknown): {
  valid: boolean;
  candidates: ProviderCandidate[];
} {
  const rawCandidates = candidateArrays(payload);
  if (!rawCandidates || rawCandidates.length > 50) {
    return { valid: false, candidates: [] };
  }

  const candidates: ProviderCandidate[] = [];
  for (const raw of rawCandidates) {
    const parsed = candidateSchema.safeParse(raw);
    if (!parsed.success) continue;
    const campuses = [
      parsed.data.nama_pt,
      parsed.data.singkatan_pt,
      parsed.data.sinkatan_pt,
    ].filter((value): value is string => Boolean(value?.trim()));
    const programs = [parsed.data.nama_prodi, parsed.data.prodi].filter(
      (value): value is string => Boolean(value?.trim()),
    );
    if (!campuses.length || !programs.length) continue;
    candidates.push({
      nama: parsed.data.nama,
      nim: String(parsed.data.nim),
      campuses,
      programs,
    });
  }

  return {
    valid: rawCandidates.length === 0 || candidates.length > 0,
    candidates,
  };
}

export function matchAcademicClaim(
  claim: AcademicLookupClaim,
  candidates: ProviderCandidate[],
): Pick<AcademicLookupResult, "outcome" | "candidateCount" | "exactMatchFound" | "schemaValid"> {
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
    };
  }

  const name = normalizeAcademicText(claim.legalName);
  const campus = normalizeCampusForMatch(claim.campus);
  const program = normalizeProgramForMatch(claim.studyProgram);
  const exactMatchFound = sameNim.some(
    (candidate) =>
      normalizeAcademicText(candidate.nama) === name &&
      candidate.campuses.some(
        (candidateCampus) => normalizeCampusForMatch(candidateCampus) === campus,
      ) &&
      candidate.programs.some(
        (candidateProgram) => normalizeProgramForMatch(candidateProgram) === program,
      ),
  );

  return {
    outcome: exactMatchFound ? "academic_match" : "mismatch",
    candidateCount: candidates.length,
    exactMatchFound,
    schemaValid: true,
  };
}
