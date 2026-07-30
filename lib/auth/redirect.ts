const AUTHENTICATED_DESTINATIONS = new Set(["/app", "/onboarding"]);

export function getSafeAuthenticatedDestination(
  destination: string | null | undefined,
) {
  return destination && AUTHENTICATED_DESTINATIONS.has(destination)
    ? destination
    : "/app";
}
