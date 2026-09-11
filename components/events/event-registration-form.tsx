"use client";

import { registerCampusEventAction } from "@/app/app/events/actions";
import {
  EVENT_QUESTION_OPTIONS_MAX,
  EVENT_SHORT_ANSWER_MAX,
} from "@/lib/events/constants";
import type { CampusEventQuestion } from "@/lib/events/service";
import { useRef } from "react";

export function EventRegistrationForm({
  publicSlug,
  questions,
  profile,
  submitLabel,
}: {
  publicSlug: string;
  questions: CampusEventQuestion[];
  profile: { campus: string; studyProgram: string; semester: number | null };
  submitLabel: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={registerCampusEventAction}
      className="space-y-6"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const answers: Record<string, string | string[] | boolean> = {};
        for (const question of questions) {
          if (question.question_type === "multi_select") {
            answers[question.question_public_id] = data
              .getAll(`question-${question.question_public_id}`)
              .filter((value): value is string => typeof value === "string")
              .slice(0, EVENT_QUESTION_OPTIONS_MAX);
          } else if (question.question_type === "checkbox") {
            answers[question.question_public_id] =
              data.get(`question-${question.question_public_id}`) === "on";
          } else {
            const value = data.get(`question-${question.question_public_id}`);
            if (typeof value === "string") {
              answers[question.question_public_id] = value;
            }
          }
        }
        const hidden = formRef.current?.elements.namedItem("answers");
        if (hidden instanceof HTMLInputElement) {
          hidden.value = JSON.stringify(answers);
        }
      }}
    >
      <input type="hidden" name="publicSlug" value={publicSlug} />
      <input type="hidden" name="answers" value="{}" />

      <aside className="border-l-2 border-brand-blue pl-4 text-sm leading-6 text-brand-muted">
        <p className="font-semibold text-brand-navy">Profil yang digunakan</p>
        <p className="mt-1 break-words">
          {profile.campus} · {profile.studyProgram}
          {profile.semester ? ` · Semester ${profile.semester}` : ""}
        </p>
        <p className="mt-1 text-xs">
          Data ini berasal dari profilmu dan tidak perlu ditanyakan ulang oleh penyelenggara.
        </p>
      </aside>

      {questions.map((question) => {
        const name = `question-${question.question_public_id}`;
        const legend = (
          <>
            {question.prompt}
            {question.is_required ? <span aria-hidden="true"> *</span> : null}
          </>
        );

        if (question.question_type === "short_text") {
          return (
            <label
              key={question.question_public_id}
              className="block text-sm font-semibold text-brand-navy"
            >
              {legend}
              <textarea
                name={name}
                required={question.is_required}
                maxLength={EVENT_SHORT_ANSWER_MAX}
                rows={3}
                className="focus-ring mt-2 w-full resize-y rounded-xl border border-brand-border bg-white px-4 py-3 text-sm leading-6"
              />
            </label>
          );
        }

        if (question.question_type === "single_select") {
          return (
            <label
              key={question.question_public_id}
              className="block text-sm font-semibold text-brand-navy"
            >
              {legend}
              <select
                name={name}
                required={question.is_required}
                defaultValue=""
                className="focus-ring mt-2 min-h-12 w-full rounded-xl border border-brand-border bg-white px-4 text-sm"
              >
                <option value="" disabled>
                  Pilih jawaban
                </option>
                {question.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        return (
          <fieldset key={question.question_public_id}>
            <legend className="text-sm font-semibold text-brand-navy">{legend}</legend>
            <div className="mt-3 space-y-2">
              {question.question_type === "checkbox" ? (
                <label className="flex min-h-11 items-start gap-3 text-sm leading-6 text-brand-muted">
                  <input
                    type="checkbox"
                    name={name}
                    required={question.is_required}
                    className="mt-1 h-4 w-4 shrink-0 accent-brand-blue"
                  />
                  <span>Saya menyetujui pernyataan ini.</span>
                </label>
              ) : (
                question.options.map((option) => (
                  <label
                    key={option}
                    className="flex min-h-11 items-start gap-3 text-sm leading-6 text-brand-muted"
                  >
                    <input
                      type="checkbox"
                      name={name}
                      value={option}
                      className="mt-1 h-4 w-4 shrink-0 accent-brand-blue"
                    />
                    <span>{option}</span>
                  </label>
                ))
              )}
            </div>
          </fieldset>
        );
      })}

      <button
        type="submit"
        className="focus-ring min-h-12 w-full rounded-xl bg-brand-blue px-5 text-sm font-semibold text-white sm:w-auto"
      >
        {submitLabel}
      </button>
    </form>
  );
}
