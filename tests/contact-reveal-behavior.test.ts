/**
 * Behavioral Contact Reveal tests.
 * Exercises the faithful in-memory authorization model.
 * Static SQL contracts live in contact-reveal.test.ts.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { ContactRevealBehaviorModel } from "../lib/contact-reveal/behavior-model.ts";

const A = "user-a";
const B = "user-b";
const C = "user-c";
const STAFF = "user-staff";
const PUBLIC_X = "aa".repeat(16);
const PUBLIC_Y = "bb".repeat(16);

function seedEligiblePair(model: ContactRevealBehaviorModel) {
  model.seedStudent(A);
  model.seedStudent(B);
  model.seedStudent(C);
  return model.seedConversation({
    publicId: PUBLIC_X,
    senderId: A,
    recipientId: B,
    mutual: true,
    identityRevealed: true,
  });
}

function channelState(
  model: ContactRevealBehaviorModel,
  userId: string,
  channel: "telegram" | "instagram" | "linkedin",
) {
  return model
    .getState(userId, PUBLIC_X)
    .channels.find((item) => item.channel === channel)!;
}

test("1. anonymous caller is rejected", () => {
  const model = new ContactRevealBehaviorModel();
  seedEligiblePair(model);
  assert.throws(() => model.getState(null, PUBLIC_X), /auth/);
  assert.throws(
    () => model.select(null, PUBLIC_X, "telegram", "cver-1"),
    /auth/,
  );
});

test("2. student C cannot inspect A–B state", () => {
  const model = new ContactRevealBehaviorModel();
  seedEligiblePair(model);
  const state = model.getState(C, PUBLIC_X);
  for (const channel of state.channels) {
    assert.equal(channel.eligible, false);
    assert.equal(channel.hasContact, false);
    assert.equal(channel.selectedByMe, false);
    assert.equal(channel.completed, false);
  }
});

test("3. contact creation before Identity Reveal is rejected", () => {
  const model = new ContactRevealBehaviorModel();
  model.seedStudent(A);
  model.seedStudent(B);
  model.seedConversation({
    publicId: PUBLIC_X,
    senderId: A,
    recipientId: B,
    mutual: true,
    identityRevealed: false,
  });
  assert.throws(
    () =>
      model.registerVersion({
        actorRole: "service_role",
        publicId: PUBLIC_X,
        ownerUserId: A,
        channel: "telegram",
        value: "andi_campus",
      }),
    /unavailable/,
  );
});

test("4. contact for an unrelated conversation owner is rejected", () => {
  const model = new ContactRevealBehaviorModel();
  seedEligiblePair(model);
  model.seedConversation({
    publicId: PUBLIC_Y,
    senderId: A,
    recipientId: C,
    mutual: true,
    identityRevealed: true,
  });
  assert.throws(
    () =>
      model.registerVersion({
        actorRole: "service_role",
        publicId: PUBLIC_Y,
        ownerUserId: B,
        channel: "telegram",
        value: "budi_campus",
      }),
    /unavailable/,
  );
});

test("5. A cannot create a contact owned by B", () => {
  const model = new ContactRevealBehaviorModel();
  seedEligiblePair(model);
  const version = model.createContactAsAuthenticated({
    actorId: A,
    publicId: PUBLIC_X,
    claimedOwnerUserId: B,
    channel: "telegram",
    value: "forged_b",
  });
  assert.equal(version.ownerUserId, A);
  assert.notEqual(version.ownerUserId, B);
  assert.throws(
    () => model.select(B, PUBLIC_X, "telegram", version.id),
    /unavailable/,
  );
});

test("6. a conversation-X contact cannot be used in conversation Y", () => {
  const model = new ContactRevealBehaviorModel();
  seedEligiblePair(model);
  model.seedConversation({
    publicId: PUBLIC_Y,
    senderId: A,
    recipientId: C,
    mutual: true,
    identityRevealed: true,
  });
  const version = model.createContactAsAuthenticated({
    actorId: A,
    publicId: PUBLIC_X,
    channel: "telegram",
    value: "andi_x",
  });
  assert.throws(
    () => model.select(A, PUBLIC_Y, "telegram", version.id),
    /unavailable/,
  );
});

test("7. telegram version cannot be used for instagram consent", () => {
  const model = new ContactRevealBehaviorModel();
  seedEligiblePair(model);
  const version = model.createContactAsAuthenticated({
    actorId: A,
    publicId: PUBLIC_X,
    channel: "telegram",
    value: "andi_tg",
  });
  assert.throws(
    () => model.select(A, PUBLIC_X, "instagram", version.id),
    /unavailable/,
  );
});

test("8. one-sided prepare/consent never leaks to counterpart state", () => {
  const model = new ContactRevealBehaviorModel();
  seedEligiblePair(model);
  model.createContactAsAuthenticated({
    actorId: A,
    publicId: PUBLIC_X,
    channel: "telegram",
    value: "andi_tg",
  });
  const before = channelState(model, B, "telegram");
  assert.equal(before.hasContact, false);
  assert.equal(before.selectedByMe, false);
  assert.equal(before.completed, false);

  const version = model.versions.find(
    (v) => v.ownerUserId === A && v.channel === "telegram" && !v.supersededAt,
  )!;
  model.select(A, PUBLIC_X, "telegram", version.id);

  const after = channelState(model, B, "telegram");
  assert.equal(after.hasContact, false);
  assert.equal(after.selectedByMe, false);
  assert.equal(after.completed, false);
  assert.deepEqual(
    { ...before, eligible: after.eligible },
    { ...after, eligible: before.eligible },
  );
});

test("9. channels complete independently", () => {
  const model = new ContactRevealBehaviorModel();
  seedEligiblePair(model);

  const aTg = model.createContactAsAuthenticated({
    actorId: A,
    publicId: PUBLIC_X,
    channel: "telegram",
    value: "andi_tg",
  });
  const bTg = model.createContactAsAuthenticated({
    actorId: B,
    publicId: PUBLIC_X,
    channel: "telegram",
    value: "budi_tg",
  });
  model.select(A, PUBLIC_X, "telegram", aTg.id);
  model.select(B, PUBLIC_X, "telegram", bTg.id);

  assert.equal(channelState(model, A, "telegram").completed, true);
  assert.equal(channelState(model, A, "instagram").completed, false);
  assert.equal(channelState(model, A, "linkedin").completed, false);

  const completed = model.getCompleted(A, PUBLIC_X, "telegram");
  assert.equal(completed.counterpartDisplay, "budi_tg");
  assert.equal(
    model.getCompleted(A, PUBLIC_X, "instagram").completed,
    false,
  );
});

test("10. replacement invalidates only own pending consent for that channel", () => {
  const model = new ContactRevealBehaviorModel();
  seedEligiblePair(model);
  const first = model.createContactAsAuthenticated({
    actorId: A,
    publicId: PUBLIC_X,
    channel: "telegram",
    value: "andi_old",
  });
  model.select(A, PUBLIC_X, "telegram", first.id);
  assert.equal(channelState(model, A, "telegram").selectedByMe, true);

  const second = model.createContactAsAuthenticated({
    actorId: A,
    publicId: PUBLIC_X,
    channel: "telegram",
    value: "andi_new",
  });
  assert.equal(first.supersededAt != null, true);
  assert.equal(channelState(model, A, "telegram").selectedByMe, false);
  assert.equal(channelState(model, A, "telegram").hasContact, true);

  const bIg = model.createContactAsAuthenticated({
    actorId: A,
    publicId: PUBLIC_X,
    channel: "instagram",
    value: "andi.ig",
  });
  model.select(A, PUBLIC_X, "instagram", bIg.id);
  assert.equal(channelState(model, A, "instagram").selectedByMe, true);

  model.createContactAsAuthenticated({
    actorId: A,
    publicId: PUBLIC_X,
    channel: "telegram",
    value: "andi_newer",
  });
  assert.equal(channelState(model, A, "instagram").selectedByMe, true);
  assert.equal(second.supersededAt != null, true);
});

test("11. withdraw is private and allowed only before channel completion", () => {
  const model = new ContactRevealBehaviorModel();
  seedEligiblePair(model);
  const aTg = model.createContactAsAuthenticated({
    actorId: A,
    publicId: PUBLIC_X,
    channel: "telegram",
    value: "andi_tg",
  });
  model.select(A, PUBLIC_X, "telegram", aTg.id);
  model.withdraw(A, PUBLIC_X, "telegram");
  assert.equal(channelState(model, A, "telegram").selectedByMe, false);
  assert.equal(channelState(model, B, "telegram").selectedByMe, false);

  const bTg = model.createContactAsAuthenticated({
    actorId: B,
    publicId: PUBLIC_X,
    channel: "telegram",
    value: "budi_tg",
  });
  model.select(A, PUBLIC_X, "telegram", aTg.id);
  model.select(B, PUBLIC_X, "telegram", bTg.id);
  const afterComplete = model.withdraw(A, PUBLIC_X, "telegram");
  assert.equal(
    afterComplete.channels.find((c) => c.channel === "telegram")!.completed,
    true,
  );
});

test("12. staff cannot participate", () => {
  const model = new ContactRevealBehaviorModel();
  model.seedStaff(STAFF);
  model.seedStudent(B);
  model.seedConversation({
    publicId: PUBLIC_X,
    senderId: STAFF,
    recipientId: B,
    mutual: true,
    identityRevealed: true,
  });
  assert.throws(() => model.getState(STAFF, PUBLIC_X), /auth/);
  assert.throws(
    () =>
      model.registerVersion({
        actorRole: "service_role",
        publicId: PUBLIC_X,
        ownerUserId: STAFF,
        channel: "telegram",
        value: "staff_tg",
      }),
    /unavailable/,
  );
});

test("13. end after completion retains both contacts", () => {
  const model = new ContactRevealBehaviorModel();
  seedEligiblePair(model);
  const aTg = model.createContactAsAuthenticated({
    actorId: A,
    publicId: PUBLIC_X,
    channel: "telegram",
    value: "andi_tg",
  });
  const bTg = model.createContactAsAuthenticated({
    actorId: B,
    publicId: PUBLIC_X,
    channel: "telegram",
    value: "budi_tg",
  });
  model.select(A, PUBLIC_X, "telegram", aTg.id);
  model.select(B, PUBLIC_X, "telegram", bTg.id);
  model.endConversation(PUBLIC_X);
  const completed = model.getCompleted(A, PUBLIC_X, "telegram");
  assert.equal(completed.mineDisplay, "andi_tg");
  assert.equal(completed.counterpartDisplay, "budi_tg");
  assert.throws(
    () =>
      model.registerVersion({
        actorRole: "service_role",
        publicId: PUBLIC_X,
        ownerUserId: A,
        channel: "instagram",
        value: "andi.ig",
      }),
    /closed|unavailable/,
  );
});

test("14. block after completion hides counterpart contact", () => {
  const model = new ContactRevealBehaviorModel();
  seedEligiblePair(model);
  const aTg = model.createContactAsAuthenticated({
    actorId: A,
    publicId: PUBLIC_X,
    channel: "linkedin",
    value: "https://www.linkedin.com/in/andi",
  });
  const bTg = model.createContactAsAuthenticated({
    actorId: B,
    publicId: PUBLIC_X,
    channel: "linkedin",
    value: "https://www.linkedin.com/in/budi",
  });
  model.select(A, PUBLIC_X, "linkedin", aTg.id);
  model.select(B, PUBLIC_X, "linkedin", bTg.id);
  model.blockConversation(PUBLIC_X, A, B);
  const completed = model.getCompleted(A, PUBLIC_X, "linkedin");
  assert.equal(completed.completed, true);
  assert.equal(completed.mineDisplay, "https://www.linkedin.com/in/andi");
  assert.equal(completed.counterpartDisplay, null);
});

test("15. duplicate completion does not duplicate events", () => {
  const model = new ContactRevealBehaviorModel();
  seedEligiblePair(model);
  const aTg = model.createContactAsAuthenticated({
    actorId: A,
    publicId: PUBLIC_X,
    channel: "telegram",
    value: "andi_tg",
  });
  const bTg = model.createContactAsAuthenticated({
    actorId: B,
    publicId: PUBLIC_X,
    channel: "telegram",
    value: "budi_tg",
  });
  model.select(A, PUBLIC_X, "telegram", aTg.id);
  model.select(B, PUBLIC_X, "telegram", bTg.id);
  model.select(A, PUBLIC_X, "telegram", aTg.id);
  assert.equal(
    model.events.filter(
      (e) => e.type === "contact_revealed" && e.channel === "telegram",
    ).length,
    1,
  );
});
