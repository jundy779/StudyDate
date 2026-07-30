import assert from "node:assert/strict";
import test from "node:test";
import { getSafeAuthenticatedDestination } from "../lib/auth/redirect.ts";
import { magicLinkRequestSchema } from "../lib/auth/validation.ts";
import {
  completeOnboardingWithAliasRetry,
  generatePublicAlias,
} from "../lib/onboarding/service.ts";
import {
  onboardingSchema,
  type OnboardingInput,
} from "../lib/onboarding/validation.ts";

const validOnboarding = {
  firstName: "  Naya  ",
  campus: "  Universitas Indonesia  ",
  studyProgram: "  Ilmu Komputer  ",
  semester: 4,
  cityRegion: "Depok",
  shortIntro: null,
  interests: ["technology", "books"],
  connectionGoals: ["study", "friendship"],
  preferences: {
    onlineFirst: true,
    groupFirst: false,
    verifiedUsersOnly: false,
    sameCampusPreferred: true,
    crossCampusAllowed: true,
  },
  consents: {
    terms: true,
    privacy: true,
    communityGuidelines: true,
  },
} as const;

test("magic-link input normalizes a valid email and rejects invalid input", () => {
  const parsed = magicLinkRequestSchema.parse({ email: "  NAYA@EXAMPLE.COM " });
  assert.equal(parsed.email, "naya@example.com");
  assert.equal(magicLinkRequestSchema.safeParse({ email: "invalid" }).success, false);
  assert.equal(
    magicLinkRequestSchema.safeParse({
      email: "naya@example.com",
      verificationStatus: "verified",
    }).success,
    false,
  );
});
test("authenticated redirects allow only known internal destinations", () => {
  assert.equal(getSafeAuthenticatedDestination("/app"), "/app");
  assert.equal(getSafeAuthenticatedDestination("/onboarding"), "/onboarding");
  assert.equal(
    getSafeAuthenticatedDestination("https://attacker.example"),
    "/app",
  );
  assert.equal(getSafeAuthenticatedDestination("//attacker.example"), "/app");
});

test("onboarding trims profile fields and accepts approved values", () => {
  const parsed = onboardingSchema.parse(validOnboarding);
  assert.equal(parsed.firstName, "Naya");
  assert.equal(parsed.campus, "Universitas Indonesia");
  assert.equal(parsed.studyProgram, "Ilmu Komputer");
});

test("onboarding rejects every protected or invalid input class", async (t) => {
  const cases: Array<[string, unknown]> = [
    ["empty first name", { ...validOnboarding, firstName: " " }],
    ["short campus", { ...validOnboarding, campus: "A" }],
    ["long campus", { ...validOnboarding, campus: "A".repeat(121) }],
    [
      "long study program",
      { ...validOnboarding, studyProgram: "A".repeat(121) },
    ],
    ["semester below range", { ...validOnboarding, semester: 0 }],
    ["semester above range", { ...validOnboarding, semester: 17 }],
    ["long city", { ...validOnboarding, cityRegion: "A".repeat(121) }],
    ["long intro", { ...validOnboarding, shortIntro: "A".repeat(301) }],
    ["missing interest", { ...validOnboarding, interests: [] }],
    [
      "too many interests",
      {
        ...validOnboarding,
        interests: [
          "technology",
          "design",
          "business",
          "languages",
          "books",
          "film",
          "music",
        ],
      },
    ],
    ["unknown interest", { ...validOnboarding, interests: ["gaming"] }],
    ["missing goal", { ...validOnboarding, connectionGoals: [] }],
    [
      "unknown goal",
      { ...validOnboarding, connectionGoals: ["dating"] },
    ],
    [
      "missing terms consent",
      {
        ...validOnboarding,
        consents: { ...validOnboarding.consents, terms: false },
      },
    ],
    [
      "missing privacy consent",
      {
        ...validOnboarding,
        consents: { ...validOnboarding.consents, privacy: false },
      },
    ],
    [
      "missing guidelines consent",
      {
        ...validOnboarding,
        consents: {
          ...validOnboarding.consents,
          communityGuidelines: false,
        },
      },
    ],
    [
      "protected verification status",
      { ...validOnboarding, verificationStatus: "verified" },
    ],
    ["protected alias", { ...validOnboarding, publicAlias: "Partner #111111" }],
    ["protected discoverability", { ...validOnboarding, isDiscoverable: true }],
  ];

  for (const [name, input] of cases) {
    await t.test(name, () => {
      assert.equal(onboardingSchema.safeParse(input).success, false);
    });
  }
});

test("public aliases use six random digits without user-derived data", () => {
  for (let index = 0; index < 100; index += 1) {
    assert.match(generatePublicAlias(), /^Partner #[0-9]{6}$/);
  }
});

test("alias collision retries before the atomic onboarding call succeeds", async () => {
  const aliases = ["Partner #123456", "Partner #654321"];
  const attempts: string[] = [];
  const input = onboardingSchema.parse(validOnboarding) as OnboardingInput;

  const result = await completeOnboardingWithAliasRetry(
    input,
    async (alias) => {
      attempts.push(alias);
      return attempts.length === 1
        ? { error: { code: "23505" } }
        : { error: null };
    },
    () => aliases.shift() ?? "Partner #999999",
  );

  assert.deepEqual(attempts, ["Partner #123456", "Partner #654321"]);
  assert.equal(result.alias, "Partner #654321");
});

test("non-collision database errors are not exposed or retried", async () => {
  const input = onboardingSchema.parse(validOnboarding) as OnboardingInput;
  let attempts = 0;

  await assert.rejects(
    completeOnboardingWithAliasRetry(input, async () => {
      attempts += 1;
      return { error: { code: "42501", message: "private database detail" } };
    }),
    /ONBOARDING_WRITE_FAILED/,
  );
  assert.equal(attempts, 1);
});
