"use client";

import { Star } from "lucide-react";
import { useState } from "react";

const LABELS = ["", "Kurang", "Biasa saja", "Lumayan", "Bagus", "Keren banget"];

/** Radio bawaan browser yang tampil sebagai bintang; tetap jalan dengan keyboard. */
export function StarRatingInput({
  name = "rating",
  defaultValue,
}: {
  name?: string;
  defaultValue?: number | null;
}) {
  const [value, setValue] = useState<number>(defaultValue ?? 0);
  const [hover, setHover] = useState<number>(0);
  const shown = hover || value;

  return (
    <fieldset>
      <legend className="text-sm font-semibold text-brand-navy">Nilai acaranya</legend>
      <div className="mt-2 flex items-center gap-3">
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((star) => (
            <label
              key={star}
              className="cursor-pointer rounded-lg p-1 focus-within:ring-2 focus-within:ring-brand-blue focus-within:ring-offset-1"
              onMouseEnter={() => setHover(star)}
            >
              <input
                type="radio"
                name={name}
                value={star}
                required
                checked={value === star}
                onChange={() => setValue(star)}
                className="sr-only"
              />
              <Star
                aria-hidden="true"
                className={`h-8 w-8 transition-transform motion-reduce:transition-none ${
                  star <= shown
                    ? "fill-[#FFC83D] text-brand-navy"
                    : "fill-white text-brand-navy/30"
                } ${star === hover ? "scale-110" : ""}`}
                strokeWidth={1.8}
              />
              <span className="sr-only">
                {star} dari 5, {LABELS[star]}
              </span>
            </label>
          ))}
        </div>
        <span className="font-hand text-lg text-brand-blue" aria-hidden="true">
          {LABELS[shown] ?? ""}
        </span>
      </div>
    </fieldset>
  );
}
