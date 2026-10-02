import {
  connectionGoalLabels,
  interestLabels,
} from "@/lib/people/constants";
import {
  hasSharedStudentContext,
  type SharedStudentContext,
} from "@/lib/people/shared-context";
import { Sparkles } from "lucide-react";

export function SharedContextSummary({
  context,
  compact = false,
}: {
  context: SharedStudentContext;
  compact?: boolean;
}) {
  if (!hasSharedStudentContext(context)) return null;

  const items = [
    ...(context.sameStudyProgram ? ["Program studi yang sama"] : []),
    ...(context.sameCampus ? ["Satu kampus"] : []),
    ...context.sharedInterestKeys.map(
      (interest) => interestLabels.get(interest) ?? interest,
    ),
    ...context.sharedGoalKeys.map(
      (goal) => connectionGoalLabels.get(goal) ?? goal,
    ),
  ].slice(0, compact ? 3 : 5);

  return (
    <div
      className={
        compact
          ? "mt-5 rounded-xl bg-blue-50/80 p-3"
          : "mt-6 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:mt-7 sm:p-5"
      }
    >
      <p className="flex items-center gap-2 text-sm font-semibold text-brand-blue">
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
        Kesamaan kalian
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {items.map((item, index) => (
          <span
            key={`${index}-${item}`}
            className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-navy shadow-[0_1px_0_rgba(15,27,51,0.06)]"
          >
            {item}
          </span>
        ))}
      </div>
      {compact ? null : (
        <p className="mt-3 text-sm leading-6 text-brand-muted">
          Ini hanya petunjuk untuk memulai obrolan, bukan nilai kecocokan.
        </p>
      )}
    </div>
  );
}
