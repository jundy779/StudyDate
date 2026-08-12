import type {
  AcademicLookupClaim,
  AcademicLookupProvider,
  AcademicLookupResult,
} from "./provider-core.ts";

type ProviderLookupInput = AcademicLookupClaim & {
  providerConsent: "true";
};

export async function runAcademicLookupProvider(
  input: ProviderLookupInput,
  provider: AcademicLookupProvider,
  gate: { eligible: boolean; providerReady: boolean },
  signal?: AbortSignal,
): Promise<AcademicLookupResult | null> {
  if (!gate.eligible || input.providerConsent !== "true") return null;
  if (!gate.providerReady) return {
    outcome: "provider_unavailable",
    candidateCount: 0,
    exactMatchFound: false,
    schemaValid: false,
    academicStatusPresent: false,
    matchComponents: null,
    latencyMs: 0,
  };
  return provider.lookup(input, signal);
}
