export type IntroductionSuggestion = {
  label: string;
  message: string;
};

type IntroductionSuggestionInput = {
  sharedInterestLabels?: string[];
  sharedGoalLabels?: string[];
};

export function buildIntroductionSuggestions({
  sharedInterestLabels = [],
  sharedGoalLabels = [],
}: IntroductionSuggestionInput): IntroductionSuggestion[] {
  const suggestions: IntroductionSuggestion[] = [];
  const sharedInterest = sharedInterestLabels[0]?.trim();
  const sharedGoal = sharedGoalLabels[0]?.trim();

  if (sharedInterest) {
    suggestions.push({
      label: `Bahas ${sharedInterest}`,
      message: `Hai, aku juga tertarik dengan ${sharedInterest}. Kalau kamu berkenan, kita bisa ngobrol dan berbagi pengalaman soal itu.`,
    });
  }

  if (sharedGoal) {
    suggestions.push({
      label: sharedGoal,
      message: `Hai, aku lihat kita sama-sama ingin ${sharedGoal.toLocaleLowerCase("id-ID")}. Kalau kamu berkenan, yuk ngobrol dulu di sini.`,
    });
  }

  suggestions.push({
    label: "Belajar bareng",
    message:
      "Hai, aku tertarik kenalan dan belajar bareng. Kalau kamu berkenan, kita bisa mulai dengan cerita soal kegiatan kuliah masing-masing.",
  });

  return suggestions
    .filter(
      (suggestion, index, items) =>
        items.findIndex((item) => item.label === suggestion.label) === index,
    )
    .slice(0, 3);
}
