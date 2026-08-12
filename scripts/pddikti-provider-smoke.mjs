import { readFileSync } from "node:fs";
import {
  normalizeAcademicText,
  normalizeCampusForMatch,
  normalizeProgramForMatch,
  normalizeProviderNim,
} from "../lib/verification/provider-core.ts";
import { PddiktiAcademicLookupProvider } from "../lib/verification/pddikti-provider.ts";

const endpoint = process.env.PDDIKTI_PROVIDER_BASE_URL;
const accessKey = process.env.PDDIKTI_PROVIDER_ACCESS_KEY;

if (!endpoint || !accessKey) {
  console.log("provider_credentials_configured: false");
  process.exitCode = 1;
} else {
  const metrics = {
    provider_reachable: false,
    http_success: false,
    latency_ms: 0,
    schema_valid: false,
    response_within_limit: false,
    candidate_count: 0,
    exact_match_found: false,
    normalization_valid: false,
    provider_retry_used: false,
    provider_error_class: "network",
    academic_status_field_present: false,
    academic_status_policy_decision_required: true,
  };
  let attempts = 0;
  let status = 0;
  let transportError = "network";
  let claim;
  try {
    if (process.stdin.isTTY) {
      console.log("smoke_input_configured: false");
      process.exitCode = 1;
      throw new Error("Private smoke input required.");
    }
    const privateInput = JSON.parse(readFileSync(0, "utf8"));
    if (
      !privateInput ||
      typeof privateInput.nim !== "string" ||
      typeof privateInput.legalName !== "string" ||
      typeof privateInput.campus !== "string" ||
      typeof privateInput.studyProgram !== "string"
    ) {
      throw new Error("Invalid private smoke input.");
    }
    claim = privateInput;
    metrics.normalization_valid =
      normalizeProviderNim(`${claim.nim} `) === normalizeProviderNim(claim.nim) &&
      normalizeAcademicText(` ${claim.legalName} `) ===
        normalizeAcademicText(claim.legalName) &&
      normalizeCampusForMatch(` ${claim.campus} `) ===
        normalizeCampusForMatch(claim.campus) &&
      normalizeProgramForMatch(` ${claim.studyProgram} `) ===
        normalizeProgramForMatch(claim.studyProgram);
    process.env.PDDIKTI_LOOKUP_PROVIDER_ENABLED = "true";
    const provider = new PddiktiAcademicLookupProvider(async (input, init) => {
      attempts += 1;
      try {
        const response = await fetch(input, init);
        status = response.status;
        metrics.provider_reachable = true;
        metrics.http_success = response.ok;
        metrics.response_within_limit =
          Number(response.headers.get("content-length") ?? "0") <= 256_000;
        return response;
      } catch (error) {
        transportError =
          error instanceof Error &&
          (error.name === "TimeoutError" || error.name === "AbortError")
            ? "timeout"
            : "network";
        throw error;
      }
    });
    const result = await provider.lookup(claim);
    metrics.latency_ms = Math.round(result.latencyMs);
    metrics.schema_valid = result.schemaValid;
    metrics.candidate_count = result.candidateCount;
    metrics.exact_match_found = result.exactMatchFound;
    metrics.provider_retry_used = attempts > 1;
    metrics.academic_status_field_present = result.academicStatusPresent;
    if (result.outcome === "provider_invalid_response") {
      metrics.provider_error_class = "invalid_response";
    } else if (result.outcome !== "provider_unavailable") {
      metrics.provider_error_class = "none";
    } else if (status === 429) {
      metrics.provider_error_class = "rate_limited";
    } else if (status >= 500) {
      metrics.provider_error_class = "server_error";
    } else if (status >= 400) {
      metrics.provider_error_class = "client_error";
    } else {
      metrics.provider_error_class = transportError;
    }
  } catch {
    process.exitCode = 1;
  } finally {
    if (claim) {
      claim.nim = "";
      claim.legalName = "";
      claim.campus = "";
      claim.studyProgram = "";
    }
    delete process.env.PDDIKTI_LOOKUP_PROVIDER_ENABLED;
  }
  console.log("PDDIKTI REAL PROVIDER SMOKE");
  for (const [key, value] of Object.entries(metrics)) {
    console.log(`${key}: ${value}`);
  }
}
