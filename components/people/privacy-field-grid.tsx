import { Lock as LockIcon } from "lucide-react";

export type PrivacyFieldState = "locked" | "unlocked" | "never";

export type PrivacyField = {
  id: string;
  label: string;
  state: PrivacyFieldState;
  /** Only pass real values when state === "unlocked". Never pass secrets for locked. */
  value?: string | null;
  lockedHint?: string;
};

export function PrivacyFieldCard({ field }: { field: PrivacyField }) {
  const isLocked = field.state === "locked";
  const isNever = field.state === "never";

  return (
    <div
      className={`min-w-0 rounded-[18px] border px-4 py-3.5 sm:px-4 sm:py-4 ${
        isLocked || isNever
          ? "border-dashed border-brand-border bg-brand-surface/80"
          : "border-brand-border bg-white"
      }`}
    >
      <p className="text-xs font-semibold text-brand-muted">{field.label}</p>
      <div className="mt-2 min-h-6 text-sm font-semibold leading-6 text-brand-navy">
        {isNever ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-brand-muted">
            <LockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Tidak dibagikan
          </span>
        ) : isLocked ? (
          <span className="inline-flex items-center gap-1.5 font-medium text-brand-muted">
            <LockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Terkunci
            <span className="sr-only">
              {field.lockedHint ?? "Terkunci sampai tahap privasi berikutnya"}
            </span>
          </span>
        ) : (
          <span className="break-words">{field.value?.trim() || "—"}</span>
        )}
      </div>
    </div>
  );
}

export function PrivacyFieldGrid({ fields }: { fields: PrivacyField[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
      {fields.map((field) => (
        <PrivacyFieldCard key={field.id} field={field} />
      ))}
    </div>
  );
}
