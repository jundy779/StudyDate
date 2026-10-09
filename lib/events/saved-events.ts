export const SAVED_EVENTS_STORAGE_KEY = "studydate:saved-events:v1";
export const SAVED_EVENTS_CHANGED_EVENT = "studydate:saved-events-changed";
export const MAX_SAVED_EVENTS = 100;

function isValidSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 160 &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
  );
}

function normalizeSavedEventSlugs(value: unknown) {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.filter(isValidSlug))].slice(0, MAX_SAVED_EVENTS);
}

export function readSavedEventSlugs(storage: Storage | null | undefined) {
  if (!storage) return [];

  try {
    const raw = storage.getItem(SAVED_EVENTS_STORAGE_KEY);
    if (!raw) return [];
    return normalizeSavedEventSlugs(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function isEventSaved(
  storage: Storage | null | undefined,
  eventSlug: string,
) {
  return readSavedEventSlugs(storage).includes(eventSlug);
}

export function toggleSavedEvent(
  storage: Storage | null | undefined,
  eventSlug: string,
) {
  if (!storage || !isValidSlug(eventSlug)) return false;

  const current = readSavedEventSlugs(storage);
  const alreadySaved = current.includes(eventSlug);
  const next = alreadySaved
    ? current.filter((slug) => slug !== eventSlug)
    : [eventSlug, ...current].slice(0, MAX_SAVED_EVENTS);

  try {
    storage.setItem(SAVED_EVENTS_STORAGE_KEY, JSON.stringify(next));
    return !alreadySaved;
  } catch {
    return alreadySaved;
  }
}
