import { CONNECTION_GOALS, INTERESTS } from "@/lib/onboarding/constants";

export { CONNECTION_GOALS, INTERESTS };

export const PEOPLE_PAGE_SIZE = 12;

export const PEOPLE_MASCOTS = [
  "/brand/mascot/front.png",
  "/brand/mascot/hello.png",
  "/brand/mascot/study.png",
  "/brand/mascot/chat.png",
] as const;

export const connectionGoalLabels = new Map<string, string>(
  CONNECTION_GOALS.map((goal) => [goal.value, goal.label]),
);

export const interestLabels = new Map<string, string>(
  INTERESTS.map((interest) => [interest.value, interest.label]),
);

export function getMascotForAlias(alias: string) {
  const hash = Array.from(alias).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );

  return PEOPLE_MASCOTS[hash % PEOPLE_MASCOTS.length];
}
