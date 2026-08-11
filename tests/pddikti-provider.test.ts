import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  matchAcademicClaim,
  normalizeAcademicText,
  normalizeCampusForMatch,
  normalizeProviderNim,
  parseProviderCandidates,
} from "../lib/verification/provider-core.ts";
import { PddiktiAcademicLookupProvider } from "../lib/verification/pddikti-provider.ts";
const claim = {
  nim: "0012-3456",
  legalName: "Sinta   Pratama",
  campus: "Universitas Nusantara",
  studyProgram: "Teknik Informatika",
};
const exact = {
  nama: "sinta pratama",
  nim: " 0012-3456 ",
  nama_pt: "UNIVERSITAS NUSANTARA",
  nama_prodi: "Teknik   Informatika",
};

test("normalization preserves NIM leading zeroes and normalizes Unicode spacing", () => {
  assert.equal(normalizeProviderNim(" 0012-3456 "), "00123456");
  assert.equal(normalizeAcademicText("  SINTA   Pratama "), "sinta pratama");
  assert.equal(
    normalizeCampusForMatch("Universitas Nusantara"),
    normalizeCampusForMatch("Universitas   Nusantara"),
  );
  assert.notEqual(
    normalizeCampusForMatch("Sekolah Tinggi Nusantara"),
    normalizeCampusForMatch("Universitas Nusantara"),
  );
});

test("provider payload supports no result, many candidates, and exact candidate not first", () => {
  const empty = parseProviderCandidates({ status: true, data: [] });
  assert.deepEqual(empty, { valid: true, candidates: [] });

  const parsed = parseProviderCandidates({
    status: true,
    data: [
      { ...exact, nim: "99999999" },
      exact,
      { ...exact, nim: "88888888" },
    ],
  });
  assert.equal(parsed.valid, true);
  const result = matchAcademicClaim(claim, parsed.candidates);
  assert.equal(result.outcome, "academic_match");
  assert.equal(result.exactMatchFound, true);
  assert.equal(result.candidateCount, 3);
});

test("same NIM with name, campus, or program mismatch never auto-matches", () => {
  for (const candidate of [
    { ...exact, nama: "Nama Berbeda" },
    { ...exact, nama_pt: "Kampus Berbeda" },
    { ...exact, nama_prodi: "Program Berbeda" },
  ]) {
    const parsed = parseProviderCandidates({ status: true, data: [candidate] });
    assert.equal(matchAcademicClaim(claim, parsed.candidates).outcome, "mismatch");
  }
});

test("unrelated candidates become not_found and are not projected", () => {
  const parsed = parseProviderCandidates({
    status: true,
    data: [{ ...exact, nim: "77777777", nama: "Orang Lain" }],
  });
  const result = matchAcademicClaim(claim, parsed.candidates);
  assert.deepEqual(result, {
    outcome: "not_found",
    candidateCount: 1,
    exactMatchFound: false,
    schemaValid: true,
  });
  assert.equal("candidates" in result, false);
});

test("status false and malformed payload are invalid", () => {
  assert.equal(parseProviderCandidates({ status: false, data: [] }).valid, false);
  assert.equal(parseProviderCandidates("invalid").valid, false);
  assert.equal(
    parseProviderCandidates({ status: true, data: [{ nama: "Incomplete" }] }).valid,
    false,
  );
  assert.equal(
    parseProviderCandidates({ status: true, data: [{ ...exact, nim: 123456 }] }).valid,
    false,
  );
});

const providerSource = readFileSync(
  new URL("../lib/verification/pddikti-provider.ts", import.meta.url),
  "utf8",
);

test("adapter contract handles exact match, malformed responses, status classes, timeout, and abort", () => {
  assert.match(providerSource, /matchAcademicClaim\(claim, parsed\.candidates\)/);
  assert.match(providerSource, /provider_invalid_response/);
  assert.match(providerSource, /response\.status === 429 \|\| response\.status >= 500/);
  assert.match(providerSource, /MAX_ATTEMPTS = 2/);
  assert.match(providerSource, /AbortSignal\.timeout\(TIMEOUT_MS\)/);
  assert.match(providerSource, /externalSignal\?\.aborted/);
});

function withProviderEnv<T>(callback: () => Promise<T>) {
  const previous = {
    enabled: process.env.PDDIKTI_LOOKUP_PROVIDER_ENABLED,
    url: process.env.PDDIKTI_PROVIDER_BASE_URL,
    key: process.env.PDDIKTI_PROVIDER_ACCESS_KEY,
  };
  process.env.PDDIKTI_LOOKUP_PROVIDER_ENABLED = "true";
  process.env.PDDIKTI_PROVIDER_BASE_URL =
    "https://provider.invalid/api/tools/pddikti-mahasiswa";
  process.env.PDDIKTI_PROVIDER_ACCESS_KEY = "synthetic-test-key";
  return callback().finally(() => {
    if (previous.enabled === undefined) delete process.env.PDDIKTI_LOOKUP_PROVIDER_ENABLED;
    else process.env.PDDIKTI_LOOKUP_PROVIDER_ENABLED = previous.enabled;
    if (previous.url === undefined) delete process.env.PDDIKTI_PROVIDER_BASE_URL;
    else process.env.PDDIKTI_PROVIDER_BASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.PDDIKTI_PROVIDER_ACCESS_KEY;
    else process.env.PDDIKTI_PROVIDER_ACCESS_KEY = previous.key;
  });
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("adapter executes exact matching without projecting candidate data", async () => {
  await withProviderEnv(async () => {
    let requestedUrl = "";
    const provider = new PddiktiAcademicLookupProvider(async (input) => {
      requestedUrl = String(input);
      return jsonResponse({ status: true, data: [{ ...exact, nim: "99999999" }, exact] });
    });
    const result = await provider.lookup(claim);
    assert.equal(result.outcome, "academic_match");
    assert.equal(result.exactMatchFound, true);
    assert.equal(result.candidateCount, 2);
    assert.equal("candidates" in result, false);
    assert.equal(new URL(requestedUrl).searchParams.get("query"), claim.nim.trim());
  });
});

test("adapter handles 4xx, retryable 5xx, invalid JSON, and abort", async () => {
  await withProviderEnv(async () => {
    let calls = 0;
    const unavailable = new PddiktiAcademicLookupProvider(async () => {
      calls += 1;
      return new Response(null, { status: calls === 1 ? 503 : 429 });
    });
    assert.equal((await unavailable.lookup(claim)).outcome, "provider_unavailable");
    assert.equal(calls, 2);

    calls = 0;
    const clientError = new PddiktiAcademicLookupProvider(async () => {
      calls += 1;
      return new Response(null, { status: 400 });
    });
    assert.equal((await clientError.lookup(claim)).outcome, "provider_unavailable");
    assert.equal(calls, 1);

    const invalidJson = new PddiktiAcademicLookupProvider(
      async () => new Response("{invalid", { status: 200 }),
    );
    assert.equal(
      (await invalidJson.lookup(claim)).outcome,
      "provider_invalid_response",
    );

    const controller = new AbortController();
    controller.abort();
    const aborted = new PddiktiAcademicLookupProvider(async () => {
      throw new DOMException("Aborted", "AbortError");
    });
    assert.equal(
      (await aborted.lookup(claim, controller.signal)).outcome,
      "provider_unavailable",
    );
  });
});
