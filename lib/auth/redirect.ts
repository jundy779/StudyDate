const AUTHENTICATED_DESTINATIONS = new Set(["/app", "/onboarding", "/staff"]);

export function getSafeAuthenticatedDestination(
  destination: string | null | undefined,
) {
  return destination && AUTHENTICATED_DESTINATIONS.has(destination)
    ? destination
    : "/app";
}
