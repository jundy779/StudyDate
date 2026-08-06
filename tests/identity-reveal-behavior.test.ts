/**
 * Behavioral Identity Reveal tests.
 * Exercises the faithful in-memory authorization model and Sharp photo pipeline.
 * These are NOT static SQL string matches — see identity-reveal.test.ts for contracts.
 */
import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  IDENTITY_REVEAL_COPY,
  IDENTITY_REVEAL_MAX_BYTES,
  IDENTITY_REVEAL_MAX_DIMENSION,
  IDENTITY_REVEAL_MIN_DIMENSION,
  IDENTITY_REVEAL_OUTPUT_MAX_EDGE,
} from "../lib/identity-reveal/constants.ts";
import { IdentityRevealBehaviorModel } from "../lib/identity-reveal/behavior-model.ts";

/** Mirrors lib/identity-reveal/photo.ts without importing server-only. */
async function processRevealPhotoLikeProduction(input: Buffer) {
  if (!input.length || input.byteLength > IDENTITY_REVEAL_MAX_BYTES) {
    throw new Error(IDENTITY_REVEAL_COPY.photoError);
  }
  const image = sharp(input, { failOn: "error", animated: false, pages: 1 });
  const metadata = await image.metadata();
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
    throw new Error(IDENTITY_REVEAL_COPY.photoError);
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new Error(IDENTITY_REVEAL_COPY.photoError);
  }
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (
    width < IDENTITY_REVEAL_MIN_DIMENSION ||
    height < IDENTITY_REVEAL_MIN_DIMENSION ||
    width > IDENTITY_REVEAL_MAX_DIMENSION ||
    height > IDENTITY_REVEAL_MAX_DIMENSION
  ) {
    throw new Error(IDENTITY_REVEAL_COPY.photoError);
  }
  const buffer = await image
    .rotate()
    .resize({
      width: IDENTITY_REVEAL_OUTPUT_MAX_EDGE,
      height: IDENTITY_REVEAL_OUTPUT_MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  return buffer;
}

const A = "user-a";
const B = "user-b";
const C = "user-c";
const STAFF = "user-staff";
const PUBLIC_X = "aa".repeat(16);
const PUBLIC_Y = "bb".repeat(16);

function seedEligiblePair(model: IdentityRevealBehaviorModel) {
  model.seedStudent(A);
  model.seedStudent(B);
  model.seedStudent(C);
  return model.seedConversation({
    publicId: PUBLIC_X,
    senderId: A,
    recipientId: B,
    mutual: true,
  });
}

test("1. anonymous caller is rejected", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  assert.throws(() => model.getState(null, PUBLIC_X), /auth/);
  assert.throws(() => model.select(null, PUBLIC_X, "ver-1"), /auth/);
});

test("2. student C cannot inspect A–B state", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  const state = model.getState(C, PUBLIC_X);
  assert.equal(state.eligible, false);
  assert.equal(state.hasProfile, false);
  assert.equal(state.selectedByMe, false);
  assert.equal(state.completed, false);
});

test("3. profile creation before Mutual Interest is rejected", () => {
  const model = new IdentityRevealBehaviorModel();
  model.seedStudent(A);
  model.seedStudent(B);
  model.seedConversation({
    publicId: PUBLIC_X,
    senderId: A,
    recipientId: B,
    mutual: false,
  });
  assert.throws(
    () =>
      model.registerProfile({
        actorRole: "service_role",
        publicId: PUBLIC_X,
        ownerUserId: A,
        firstName: "Andi",
        photoObjectKey: "a/1.jpg",
      }),
    /unavailable/,
  );
});

test("4. profile creation for an unrelated conversation is rejected", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  model.seedConversation({
    publicId: PUBLIC_Y,
    senderId: A,
    recipientId: C,
    mutual: true,
  });
  assert.throws(
    () =>
      model.registerProfile({
        actorRole: "service_role",
        publicId: PUBLIC_Y,
        ownerUserId: B,
        firstName: "Budi",
        photoObjectKey: "b/1.jpg",
      }),
    /unavailable/,
  );
});

test("5. A cannot create a profile owned by B", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  const version = model.createProfileAsAuthenticated({
    actorId: A,
    publicId: PUBLIC_X,
    claimedOwnerUserId: B,
    firstName: "Budi",
    photoObjectKey: "forged/b.jpg",
  });
  assert.equal(version.ownerUserId, A);
  assert.notEqual(version.ownerUserId, B);
  assert.throws(() => model.select(B, PUBLIC_X, version.id), /unavailable/);
});

test("6. a conversation-X profile cannot be used in conversation Y", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  model.seedConversation({
    publicId: PUBLIC_Y,
    senderId: A,
    recipientId: C,
    mutual: true,
  });
  const versionX = model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "Andi",
    photoObjectKey: "a/x.jpg",
  });
  assert.throws(() => model.select(A, PUBLIC_Y, versionX.id), /unavailable/);
});

test("7. counterpart cannot inspect prepared first name", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "SecretName",
    photoObjectKey: "a/prep.jpg",
  });
  const stateB = model.getState(B, PUBLIC_X);
  assert.equal(stateB.hasProfile, false);
  assert.equal(stateB.selectedByMe, false);
  const completed = model.getCompleted(B, PUBLIC_X);
  assert.equal(completed.completed, false);
  assert.equal(completed.counterpartFirstName, null);
});

test("8. counterpart cannot request prepared photo", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "Andi",
    photoObjectKey: "a/prep2.jpg",
  });
  assert.equal(
    model.resolvePreviewPhoto("service_role", PUBLIC_X, B),
    null,
  );
  assert.equal(
    model.resolvePhoto("service_role", PUBLIC_X, B, "counterpart"),
    null,
  );
});

test("9. one-sided consent remains hidden", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  const versionA = model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "Andi",
    photoObjectKey: "a/c1.jpg",
  });
  model.select(A, PUBLIC_X, versionA.id);
  const stateB = model.getState(B, PUBLIC_X);
  assert.equal(stateB.selectedByMe, false);
  assert.equal(stateB.completed, false);
  assert.equal(stateB.hasProfile, false);
});

test("10. replacement profile invalidates the caller’s pending consent", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  const v1 = model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "Andi",
    photoObjectKey: "a/v1.jpg",
  });
  model.select(A, PUBLIC_X, v1.id);
  assert.equal(model.getState(A, PUBLIC_X).selectedByMe, true);
  model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "Andika",
    photoObjectKey: "a/v2.jpg",
  });
  const stateA = model.getState(A, PUBLIC_X);
  assert.equal(stateA.selectedByMe, false);
  assert.equal(stateA.hasProfile, true);
  assert.ok(v1.supersededAt);
});

test("11. replacement does not reveal any state to the counterpart", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "Andi",
    photoObjectKey: "a/r1.jpg",
  });
  model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "Andika",
    photoObjectKey: "a/r2.jpg",
  });
  const stateB = model.getState(B, PUBLIC_X);
  assert.deepEqual(stateB, {
    eligible: true,
    hasProfile: false,
    selectedByMe: false,
    completed: false,
    completedAt: null,
    canWithdraw: false,
  });
});

test("12–14. two valid consents complete once; snapshot immutable; duplicate safe", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  const vA = model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "Andi",
    photoObjectKey: "a/done.jpg",
  });
  const vB = model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: B,
    firstName: "Budi",
    photoObjectKey: "b/done.jpg",
  });
  model.select(A, PUBLIC_X, vA.id);
  model.select(B, PUBLIC_X, vB.id);
  const shell = model.getShellByPublicId(PUBLIC_X)!;
  assert.ok(shell.identityRevealedAt);
  const snap1 = model.snapshots.get(shell.id)!;
  assert.equal(snap1.senderProfileVersionId, vA.id);
  assert.equal(snap1.recipientProfileVersionId, vB.id);
  assert.equal(
    model.events.filter((e) => e.type === "identity_revealed").length,
    1,
  );

  // Duplicate consent after completion is a no-op (no second snapshot/event).
  model.select(A, PUBLIC_X, vA.id);
  assert.equal(model.snapshots.size, 1);
  assert.equal(
    model.events.filter((e) => e.type === "identity_revealed").length,
    1,
  );

  const completed = model.getCompleted(A, PUBLIC_X);
  assert.equal(completed.mineFirstName, "Andi");
  assert.equal(completed.counterpartFirstName, "Budi");
});

test("15–16. student C cannot retrieve completed identity or media", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  const vA = model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "Andi",
    photoObjectKey: "a/c.jpg",
  });
  const vB = model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: B,
    firstName: "Budi",
    photoObjectKey: "b/c.jpg",
  });
  model.select(A, PUBLIC_X, vA.id);
  model.select(B, PUBLIC_X, vB.id);

  const completedC = model.getCompleted(C, PUBLIC_X);
  assert.equal(completedC.completed, false);
  assert.equal(completedC.counterpartFirstName, null);
  assert.equal(
    model.resolvePhoto("service_role", PUBLIC_X, C, "counterpart"),
    null,
  );
  assert.equal(model.resolvePhoto("service_role", PUBLIC_X, C, "mine"), null);
});

test("17. arbitrary profile/object identifiers cannot produce media", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  assert.equal(
    model.resolvePhoto("service_role", PUBLIC_X, A, "counterpart"),
    null,
  );
  assert.equal(
    model.resolvePreviewPhoto("service_role", "ff".repeat(16), A),
    null,
  );
  assert.equal(model.resolvePhoto("authenticated", PUBLIC_X, A, "mine"), null);
});

test("18–19. SVG/spoofed formats rejected; re-encode strips EXIF/GPS", async () => {
  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="red"/></svg>`,
  );
  await assert.rejects(() => processRevealPhotoLikeProduction(svg));

  const spoofed = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("not-a-real-png-payload"),
  ]);
  await assert.rejects(() => processRevealPhotoLikeProduction(spoofed));

  const withGpsComment = await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background: { r: 40, g: 90, b: 140 },
    },
  })
    .jpeg()
    .withMetadata({
      exif: {
        IFD0: {
          ImageDescription: "GPS: -6.2088, 106.8456",
          Software: "StudyDate-Test-GPS",
        },
      },
    })
    .toBuffer();

  const processed = await processRevealPhotoLikeProduction(withGpsComment);
  const outMeta = await sharp(processed).metadata();
  assert.equal(outMeta.exif, undefined);
  assert.equal(outMeta.orientation, undefined);
  assert.equal(processed.includes(Buffer.from("106.8456")), false);
  assert.equal(processed.includes(Buffer.from("StudyDate-Test-GPS")), false);
});

test("20. end-before-completion rejects consent", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  const vA = model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "Andi",
    photoObjectKey: "a/end.jpg",
  });
  model.endConversation(PUBLIC_X);
  assert.throws(() => model.select(A, PUBLIC_X, vA.id), /closed/);
});

test("21. block-before-completion rejects consent and media", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  const vA = model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "Andi",
    photoObjectKey: "a/blk.jpg",
  });
  model.blockConversation(PUBLIC_X, A, B);
  assert.throws(() => model.select(A, PUBLIC_X, vA.id), /closed/);
  assert.equal(
    model.resolvePreviewPhoto("service_role", PUBLIC_X, A),
    null,
  );
});

test("22. end-after-completion retains both identities per retention policy", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  const vA = model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "Andi",
    photoObjectKey: "a/ret.jpg",
  });
  const vB = model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: B,
    firstName: "Budi",
    photoObjectKey: "b/ret.jpg",
  });
  model.select(A, PUBLIC_X, vA.id);
  model.select(B, PUBLIC_X, vB.id);
  model.endConversation(PUBLIC_X);

  const completedA = model.getCompleted(A, PUBLIC_X);
  assert.equal(completedA.counterpartFirstName, "Budi");
  assert.equal(
    model.resolvePhoto("service_role", PUBLIC_X, A, "counterpart"),
    "b/ret.jpg",
  );
  assert.throws(
    () =>
      model.registerProfile({
        actorRole: "service_role",
        publicId: PUBLIC_X,
        ownerUserId: A,
        firstName: "New",
        photoObjectKey: "a/new.jpg",
      }),
    /unavailable|closed/,
  );
});

test("23–24. block-after-completion rejects future identity and media", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  const vA = model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "Andi",
    photoObjectKey: "a/post.jpg",
  });
  const vB = model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: B,
    firstName: "Budi",
    photoObjectKey: "b/post.jpg",
  });
  model.select(A, PUBLIC_X, vA.id);
  model.select(B, PUBLIC_X, vB.id);
  model.blockConversation(PUBLIC_X, A, B);

  const completedA = model.getCompleted(A, PUBLIC_X);
  assert.equal(completedA.completed, true);
  assert.equal(completedA.mineFirstName, "Andi");
  assert.equal(completedA.counterpartFirstName, null);
  assert.equal(
    model.resolvePhoto("service_role", PUBLIC_X, A, "counterpart"),
    null,
  );
  assert.equal(
    model.resolvePhoto("service_role", PUBLIC_X, A, "mine"),
    "a/post.jpg",
  );
  // Snapshot retained internally.
  const shell = model.getShellByPublicId(PUBLIC_X)!;
  assert.ok(model.snapshots.get(shell.id));
});

test("25. direct Storage list/read remains unavailable to normal clients", () => {
  const model = new IdentityRevealBehaviorModel();
  seedEligiblePair(model);
  model.registerProfile({
    actorRole: "service_role",
    publicId: PUBLIC_X,
    ownerUserId: A,
    firstName: "Andi",
    photoObjectKey: "a/store.jpg",
  });
  assert.deepEqual(model.listStorageAs("anon"), []);
  assert.deepEqual(model.listStorageAs("authenticated"), []);
});

test("26. staff accounts are ineligible", () => {
  const model = new IdentityRevealBehaviorModel();
  model.seedStaff(STAFF);
  model.seedStudent(B);
  model.seedConversation({
    publicId: PUBLIC_X,
    senderId: STAFF,
    recipientId: B,
    mutual: true,
  });
  assert.throws(() => model.getState(STAFF, PUBLIC_X), /auth/);
  assert.throws(
    () =>
      model.registerProfile({
        actorRole: "service_role",
        publicId: PUBLIC_X,
        ownerUserId: STAFF,
        firstName: "Staff",
        photoObjectKey: "s/1.jpg",
      }),
    /unavailable/,
  );
});
