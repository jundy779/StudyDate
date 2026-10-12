import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeIntroductionMessage,
  openingMessageHasContact,
  validateIntroductionMessage,
} from "../src/features/social/validation.ts";

test("normalizes introduction whitespace", () => {
  assert.equal(
    normalizeIntroductionMessage("  Hai,   yuk belajar bareng.  "),
    "Hai, yuk belajar bareng.",
  );
});

test("accepts a friendly introduction without contact details", () => {
  const result = validateIntroductionMessage(
    "Hai, aku juga tertarik belajar teknologi dan diskusi bareng.",
  );
  assert.equal(result.error, null);
});

test("rejects contact details in the first introduction", () => {
  for (const message of [
    "Chat aku di @namauser saja ya",
    "Nomorku 081234567890",
    "Buka https://example.com/profilku",
    "Email aku nama@example.com",
  ]) {
    assert.equal(openingMessageHasContact(message), true);
    assert.match(validateIntroductionMessage(message).error ?? "", /Simpan/);
  }
});

test("enforces introduction length", () => {
  assert.match(validateIntroductionMessage("Hai").error ?? "", /minimal 12/);
  assert.match(validateIntroductionMessage("a".repeat(301)).error ?? "", /Maksimal 300/);
});
