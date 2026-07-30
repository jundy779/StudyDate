import assert from "node:assert/strict";
import test from "node:test";
import {
  submitEarlyAccess,
  type InsertWaitlistEntry,
} from "./service";

const validInput = {
  email: "  Student@Example.com ",
  campus: "  Universitas Indonesia  ",
  interests: ["people", "events"],
  source: "hero",
  consent: true,
  website: "",
};

test("normalizes and submits valid waitlist data", async () => {
  let insertedEmail = "";
  const insert: InsertWaitlistEntry = async (entry) => {
    insertedEmail = entry.email;
    return { error: null };
  };

  const result = await submitEarlyAccess(validInput, insert);

  assert.deepEqual(result, { status: "success" });
  assert.equal(insertedEmail, "student@example.com");
});

test("rejects an invalid email without inserting", async () => {
  let insertCalled = false;
  const result = await submitEarlyAccess(
    { ...validInput, email: "bukan-email" },
    async () => {
      insertCalled = true;
      return { error: null };
    },
  );

  assert.equal(result.status, "validation_error");
  assert.equal(insertCalled, false);
});

test("requires consent", async () => {
  const result = await submitEarlyAccess(
    { ...validInput, consent: false },
    async () => ({ error: null }),
  );

  assert.equal(result.status, "validation_error");
});

test("returns a friendly duplicate state", async () => {
  const result = await submitEarlyAccess(validInput, async () => ({
    error: { code: "23505" },
  }));

  assert.deepEqual(result, { status: "duplicate" });
});

test("returns a generic server error when insertion fails", async () => {
  const result = await submitEarlyAccess(validInput, async () => ({
    error: { code: "DATABASE_UNAVAILABLE" },
  }));

  assert.deepEqual(result, { status: "server_error" });
});

test("rejects the honeypot and never inserts", async () => {
  let insertCalled = false;
  const result = await submitEarlyAccess(
    { ...validInput, website: "spam.example" },
    async () => {
      insertCalled = true;
      return { error: null };
    },
  );

  assert.equal(result.status, "validation_error");
  assert.equal(insertCalled, false);
});
