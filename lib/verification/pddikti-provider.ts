import {
  matchAcademicClaim,
  parseProviderCandidates,
  summarizeProviderStructure,
  type AcademicLookupClaim,
  type AcademicLookupProvider,
  type AcademicLookupResult,
  type ProviderStructureSummary,
} from "./provider-core.ts";
import { TextDecoder } from "node:util";

const TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 1;
const MAX_RESPONSE_BYTES = 256_000;

export function isPddiktiProviderEnabled() {
  return (
    process.env.PDDIKTI_LOOKUP_PROVIDER_ENABLED === "true" &&
    Boolean(
      process.env.PDDIKTI_PROVIDER_ACCESS_KEY &&
      process.env.PDDIKTI_PROVIDER_BASE_URL,
    )
  );
}

function endpoint() {
  const configured = process.env.PDDIKTI_PROVIDER_BASE_URL?.trim();
  if (!configured) throw new Error("Provider unavailable.");
  const url = new URL(configured);
  if (url.protocol !== "https:") throw new Error("Provider unavailable.");
  return url;
}

function providerHeaders(url: URL) {
  return {
    accept: "application/json",
    origin: url.origin,
    referer: `${url.origin}/`,
    "user-agent": "Mozilla/5.0",
  };
}

function unavailable(latencyMs: number): AcademicLookupResult {
  return {
    outcome: "provider_unavailable",
    candidateCount: 0,
    exactMatchFound: false,
    schemaValid: false,
    academicStatusPresent: false,
    matchComponents: null,
    latencyMs,
  };
}

export class PddiktiAcademicLookupProvider implements AcademicLookupProvider {
  private readonly fetcher: typeof fetch;
  private readonly onStructure?: (summary: ProviderStructureSummary) => void;

  constructor(
    fetcher: typeof fetch = fetch,
    onStructure?: (summary: ProviderStructureSummary) => void,
  ) {
    this.fetcher = fetcher;
    this.onStructure = onStructure;
  }

  async lookup(
    claim: AcademicLookupClaim,
    externalSignal?: AbortSignal,
  ): Promise<AcademicLookupResult> {
    const startedAt = Date.now();
    const accessKey = process.env.PDDIKTI_PROVIDER_ACCESS_KEY;
    if (!isPddiktiProviderEnabled() || !accessKey) {
      return unavailable(Date.now() - startedAt);
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const url = endpoint();
        url.searchParams.set("aksesKey", accessKey);
        url.searchParams.set("query", claim.nim.trim());
        const response = await this.fetcher(url, {
          method: "GET",
          headers: providerHeaders(url),
          cache: "no-store",
          signal: externalSignal
            ? AbortSignal.any([externalSignal, AbortSignal.timeout(TIMEOUT_MS)])
            : AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) {
          return unavailable(Date.now() - startedAt);
        }

        const contentLength = Number(response.headers.get("content-length") ?? "0");
        if (contentLength > MAX_RESPONSE_BYTES) {
          return {
            outcome: "provider_invalid_response",
            candidateCount: 0,
            exactMatchFound: false,
            schemaValid: false,
            academicStatusPresent: false,
            matchComponents: null,
            latencyMs: Date.now() - startedAt,
          };
        }
        let payload: unknown;
        try {
          if (!response.body) throw new Error("Missing response body.");
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let received = 0;
          let body = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            received += value.byteLength;
            if (received > MAX_RESPONSE_BYTES) {
              await reader.cancel();
              throw new Error("Response too large.");
            }
            body += decoder.decode(value, { stream: true });
          }
          body += decoder.decode();
          payload = JSON.parse(body);
          this.onStructure?.(summarizeProviderStructure(payload));
        } catch (error) {
          if (
            error instanceof Error &&
            (error.name === "AbortError" || error.name === "TimeoutError")
          ) {
            throw error;
          }
          return {
            outcome: "provider_invalid_response",
            candidateCount: 0,
            exactMatchFound: false,
            schemaValid: false,
            academicStatusPresent: false,
            matchComponents: null,
            latencyMs: Date.now() - startedAt,
          };
        }
        const parsed = parseProviderCandidates(payload);
        if (!parsed.valid) {
          return {
            outcome: "provider_invalid_response",
            candidateCount: 0,
            exactMatchFound: false,
            schemaValid: false,
            academicStatusPresent: false,
            matchComponents: null,
            latencyMs: Date.now() - startedAt,
          };
        }
        return {
          ...matchAcademicClaim(claim, parsed.candidates),
          latencyMs: Date.now() - startedAt,
        };
      } catch (error) {
        const timedOut =
          error instanceof Error &&
          (error.name === "TimeoutError" || error.name === "AbortError");
        if (externalSignal?.aborted || timedOut || attempt === MAX_ATTEMPTS) {
          return unavailable(Date.now() - startedAt);
        }
        if (!(error instanceof TypeError)) {
          return unavailable(Date.now() - startedAt);
        }
      }
    }
    return unavailable(Date.now() - startedAt);
  }
}
