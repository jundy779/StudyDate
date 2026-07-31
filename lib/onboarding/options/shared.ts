export type OnboardingOption = {
  label: string;
  searchValue: string;
};

const indonesianCollator = new Intl.Collator("id-ID", {
  sensitivity: "base",
  numeric: true,
});

export function normalizeOptionSearch(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function createOnboardingOptions(
  labels: readonly string[],
): readonly OnboardingOption[] {
  const uniqueLabels = new Map<string, string>();

  for (const rawLabel of labels) {
    const label = rawLabel.trim();
    const searchValue = normalizeOptionSearch(label);

    if (label && searchValue && !uniqueLabels.has(searchValue)) {
      uniqueLabels.set(searchValue, label);
    }
  }

  return [...uniqueLabels.entries()]
    .map(([searchValue, label]) => ({ label, searchValue }))
    .sort((left, right) => indonesianCollator.compare(left.label, right.label));
}

export function filterOnboardingOptions(
  options: readonly OnboardingOption[],
  query: string,
) {
  const searchTerms = normalizeOptionSearch(query).split(" ").filter(Boolean);

  if (!searchTerms.length) {
    return options;
  }

  return options.filter((option) =>
    searchTerms.every((term) => option.searchValue.includes(term)),
  );
}
