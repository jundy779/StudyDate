import type {
  AcademicLookupClaim,
  AcademicLookupOutcome,
  AcademicLookupProvider,
} from "./provider-core.ts";

type ProviderLookupInput = AcademicLookupClaim & {
  providerConsent: "true";
};

export async function runAcademicLookupProvider(
  input: ProviderLookupInput,
  provider: AcademicLookupProvider,
  gate: { eligible: boolean; providerReady: boolean },
  signal?: AbortSignal,
): Promise<AcademicLookupOutcome | null> {
  if (!gate.eligible || input.providerConsent !== "true") return null;
  if (!gate.providerReady) return "provider_unavailable";
  return (await provider.lookup(input, signal)).outcome;
}
