import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  matchAcademicClaim,
  normalizeAcademicText,
  normalizeCampusForMatch,
  normalizeProviderNim,
  parseProviderCandidates,
  summarizeProviderStructure,
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
const wrapped = (
  list: unknown[],
  details: unknown[] | undefined = [],
) => ({
  status: true,
  creator: "synthetic-provider",
  result: {
    endpoint: "synthetic",
    query: "ignored-provider-query",
    list,
    ...(details === undefined ? {} : { details }),
  },
});

test("structural diagnostic reports types and counts without candidate values", () => {
  const summary = summarizeProviderStructure(wrapped([exact]));
  assert.deepEqual(summary, {
    rootObject: true,
    statusTrue: true,
    resultObject: true,
    listArray: true,
    detailsArray: true,
    listCount: 1,
    validListCandidateCount: 1,
  });
  const serialized = JSON.stringify(summary);
  for (const secret of Object.values(claim)) {
    assert.doesNotMatch(serialized, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.doesNotMatch(serialized, /nama|nim|nama_pt|nama_prodi/i);
});

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

test("real wrapper accepts empty/list-only results and exact candidate not first", () => {
  const empty = parseProviderCandidates(wrapped([]));
  assert.deepEqual(empty, { valid: true, candidates: [] });
  assert.equal(parseProviderCandidates(wrapped([], undefined)).valid, true);

  const parsed = parseProviderCandidates(
    wrapped([
      { ...exact, nim: "99999999" },
      exact,
      { ...exact, nim: "88888888" },
    ]),
  );
  assert.equal(parsed.valid, true);
  const result = matchAcademicClaim(claim, parsed.candidates);
  assert.equal(result.outcome, "academic_match");
  assert.equal(result.exactMatchFound, true);
  assert.equal(result.candidateCount, 3);
});

test("same NIM with any materially mismatched identity field never auto-matches", () => {
  for (const candidate of [
    { ...exact, nama: "Nama Berbeda" },
    { ...exact, nama_pt: "Kampus Berbeda" },
    { ...exact, nama_prodi: "Program Berbeda" },
  ]) {
    const parsed = parseProviderCandidates(wrapped([candidate]));
    assert.equal(matchAcademicClaim(claim, parsed.candidates).outcome, "mismatch");
  }
});

test("unrelated candidates become not_found and are not projected", () => {
  const parsed = parseProviderCandidates(
    wrapped([{ ...exact, nim: "77777777", nama: "Orang Lain" }]),
  );
  const result = matchAcademicClaim(claim, parsed.candidates);
  assert.equal(result.outcome, "not_found");
  assert.equal(result.candidateCount, 1);
  assert.equal(result.exactMatchFound, false);
  assert.equal(result.schemaValid, true);
  assert.equal("candidates" in result, false);
});

test("missing result, non-array list, status false, and malformed candidates are invalid", () => {
  assert.equal(parseProviderCandidates({ status: false }).valid, false);
  assert.equal(parseProviderCandidates("invalid").valid, false);
  assert.equal(parseProviderCandidates({ status: true }).valid, false);
  assert.equal(
    parseProviderCandidates({ status: true, result: { list: {} } }).valid,
    false,
  );
  assert.equal(
    parseProviderCandidates(wrapped([{ nama: "Incomplete" }])).valid,
    false,
  );
  assert.equal(
    parseProviderCandidates(wrapped([{ ...exact, nim: 123456 }])).valid,
    false,
  );
});

test("list fields canonicalize and detail fields enrich by academic identity", () => {
  const parsed = parseProviderCandidates(
    wrapped(
      [{ ...exact, sinkatan_pt: "UN", id: "list-opaque" }],
      [
        {
          id: "different-detail-opaque",
          nama: " SINTA PRATAMA ",
          nim: "0012-3456   ",
          nama_pt: " UNIVERSITAS NUSANTARA ",
          prodi: "TEKNIK INFORMATIKA",
          kode_pt: " PT-01 ",
          kode_prodi: " SI-01 ",
          jenjang: " S1 ",
          status_saat_ini: " Aktif ",
        },
      ],
    ),
  );
  assert.equal(parsed.valid, true);
  assert.deepEqual(parsed.candidates[0], {
    nim: exact.nim,
    name: exact.nama,
    campus: exact.nama_pt,
    program: exact.nama_prodi,
    campusShortName: "UN",
    level: "S1",
    academicStatus: "Aktif",
    campusCode: "PT-01",
    programCode: "SI-01",
  });
  const result = matchAcademicClaim(claim, parsed.candidates);
  assert.equal(result.academicStatusPresent, true);
  assert.equal(result.exactMatchFound, true);
});

test("details are optional and unrelated opaque IDs never drive enrichment", () => {
  const listOnly = parseProviderCandidates(wrapped([exact], undefined));
  assert.equal(listOnly.valid, true);
  assert.equal(listOnly.candidates[0].academicStatus, undefined);

  const unrelatedDetail = parseProviderCandidates(
    wrapped([exact], [
      {
        id: "same-opaque-id",
        nama: "Nama Berbeda",
        nim: exact.nim,
        nama_pt: exact.nama_pt,
        prodi: exact.nama_prodi,
        status_saat_ini: "Synthetic",
      },
    ]),
  );
  assert.equal(unrelatedDetail.candidates[0].academicStatus, undefined);
});

test("provider query is ignored and candidate processing is bounded to fifty", () => {
  const candidates = Array.from({ length: 55 }, (_, index) => ({
    ...exact,
    nim: String(index).padStart(8, "0"),
  }));
  const parsed = parseProviderCandidates({
    ...wrapped(candidates),
    result: {
      ...wrapped(candidates).result,
      query: exact.nim,
    },
  });
  assert.equal(parsed.valid, true);
  assert.equal(parsed.candidates.length, 50);
});

const providerSource = readFileSync(
  new URL("../lib/verification/pddikti-provider.ts", import.meta.url),
  "utf8",
);

test("adapter contract handles exact match, malformed responses, status classes, timeout, and abort", () => {
  assert.match(providerSource, /matchAcademicClaim\(claim, parsed\.candidates\)/);
  assert.match(providerSource, /provider_invalid_response/);
  assert.match(providerSource, /MAX_ATTEMPTS = 1/);
  assert.match(providerSource, /TIMEOUT_MS = 25_000/);
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
      return jsonResponse(wrapped([{ ...exact, nim: "99999999" }, exact]));
    });
    const result = await provider.lookup(claim);
    assert.equal(result.outcome, "academic_match");
    assert.equal(result.exactMatchFound, true);
    assert.equal(result.candidateCount, 2);
    assert.equal("candidates" in result, false);
    assert.equal("academicStatus" in result, false);
    assert.equal(new URL(requestedUrl).searchParams.get("query"), claim.nim.trim());
  });
});

test("adapter preserves the streaming 256 KB response limit", async () => {
  await withProviderEnv(async () => {
    const provider = new PddiktiAcademicLookupProvider(
      async () =>
        new Response(JSON.stringify(wrapped([exact])), {
          status: 200,
          headers: { "content-length": "256001" },
        }),
    );
    assert.equal(
      (await provider.lookup(claim)).outcome,
      "provider_invalid_response",
    );
  });
});

test("adapter rejects streamed bodies that exceed the limit without content-length", async () => {
  await withProviderEnv(async () => {
    const provider = new PddiktiAcademicLookupProvider(
      async () => new Response("x".repeat(256_001), { status: 200 }),
    );
    assert.equal(
      (await provider.lookup(claim)).outcome,
      "provider_invalid_response",
    );
  });
});

test("adapter handles 4xx/5xx, invalid JSON, and abort without duplicate calls", async () => {
  await withProviderEnv(async () => {
    let calls = 0;
    const unavailable = new PddiktiAcademicLookupProvider(async () => {
      calls += 1;
      return new Response(null, { status: 503 });
    });
    assert.equal((await unavailable.lookup(claim)).outcome, "provider_unavailable");
    assert.equal(calls, 1);

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

test("stream timeout is unavailable rather than invalid schema", async () => {
  await withProviderEnv(async () => {
    let calls = 0;
    const timedOut = new PddiktiAcademicLookupProvider(async () => {
      calls += 1;
      const stream = new ReadableStream({
        pull(controller) {
          controller.error(new DOMException("Timed out", "TimeoutError"));
        },
      });
      return new Response(stream, { status: 200 });
    });
    assert.equal((await timedOut.lookup(claim)).outcome, "provider_unavailable");
    assert.equal(calls, 1);
  });
});
