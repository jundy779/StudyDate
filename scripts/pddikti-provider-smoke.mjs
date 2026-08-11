import { performance } from "node:perf_hooks";

const query = process.argv[2]?.trim();
const expected = process.argv[3]?.trim();
const endpoint = process.env.PDDIKTI_PROVIDER_BASE_URL;
const accessKey = process.env.PDDIKTI_PROVIDER_ACCESS_KEY;

if (!query || !endpoint || !accessKey) {
  console.error(
    "Usage: configure provider env, then pass an Owner-approved query and optional expected NIM.",
  );
  process.exitCode = 1;
} else {
  const startedAt = performance.now();
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") throw new Error("HTTPS required");
    url.searchParams.set("aksesKey", accessKey);
    url.searchParams.set("query", query);
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    const body = await response.text();
    const payload = JSON.parse(body);
    const candidates = Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.result)
        ? payload.result
        : [];
    const normalizeNim = (value) =>
      String(value ?? "").trim().toUpperCase().replace(/[\s./-]+/g, "");
    const exactMatchFound = expected
      ? candidates.some(
          (candidate) => normalizeNim(candidate?.nim) === normalizeNim(expected),
        )
      : null;
    console.log(`status=${response.status}`);
    console.log(`latency_ms=${Math.round(performance.now() - startedAt)}`);
    console.log(`candidate_count=${candidates.length}`);
    console.log(
      `exact_match_found=${exactMatchFound === null ? "not_evaluated" : exactMatchFound ? "yes" : "no"}`,
    );
    console.log(`provider_schema_valid=${payload?.status === true ? "yes" : "no"}`);
  } catch {
    console.log("status=unavailable");
    console.log(`latency_ms=${Math.round(performance.now() - startedAt)}`);
    console.log("candidate_count=0");
    console.log("exact_match_found=no");
    console.log("provider_schema_valid=no");
    process.exitCode = 1;
  }
}
