import assert from "node:assert/strict";
import test from "node:test";
import { runAcademicLookupProvider } from "../lib/verification/lookup-core.ts";
import type { AcademicLookupProvider } from "../lib/verification/provider-core.ts";

const input = {
  nim: "00123456",
  legalName: "Mahasiswa Uji",
  campus: "Universitas Uji",
  studyProgram: "Teknik Informatika",
  providerConsent: "true" as const,
};

function countingProvider() {
  let calls = 0;
  const provider: AcademicLookupProvider = {
    async lookup() {
      calls += 1;
      return {
        outcome: "not_found",
        candidateCount: 0,
        exactMatchFound: false,
        schemaValid: true,
        academicStatusPresent: false,
        matchComponents: null,
        latencyMs: 1,
      };
    },
  };
  return { provider, calls: () => calls };
}

test("provider is not called when eligibility, consent, or provider gate fails", async () => {
  for (const scenario of [
    { gate: { eligible: false, providerReady: true } },
    { gate: { eligible: true, providerReady: false } },
    { gate: { eligible: true, providerReady: true }, consent: false },
  ]) {
    const counter = countingProvider();
    const result = await runAcademicLookupProvider(
      scenario.consent === false
        ? { ...input, providerConsent: "false" as "true" }
        : input,
      counter.provider,
      scenario.gate,
    );
    assert.ok(result === null || result.outcome === "provider_unavailable");
    assert.equal(counter.calls(), 0);
  }
});

test("eligible consented controlled lookup reaches only the mocked provider", async () => {
  const counter = countingProvider();
  const result = await runAcademicLookupProvider(
    input,
    counter.provider,
    { eligible: true, providerReady: true },
  );
  assert.equal(result?.outcome, "not_found");
  assert.equal(counter.calls(), 1);
});
