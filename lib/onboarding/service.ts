import { CONSENT_POLICY_VERSION } from "./constants.ts";
import type { OnboardingInput } from "./validation.ts";
import { randomInt } from "node:crypto";

const MAX_ALIAS_ATTEMPTS = 6;

type RpcError = {
  code?: string;
  message?: string;
};

type OnboardingRpcResult = {
  error: RpcError | null;
};

type ExecuteOnboarding = (
  alias: string,
  input: OnboardingInput,
  policyVersion: string,
) => Promise<OnboardingRpcResult>;

export function generatePublicAlias() {
  return `Partner #${randomInt(100000, 1000000)}`;
}

export async function completeOnboardingWithAliasRetry(
  input: OnboardingInput,
  execute: ExecuteOnboarding,
  makeAlias: () => string = generatePublicAlias,
) {
  for (let attempt = 0; attempt < MAX_ALIAS_ATTEMPTS; attempt += 1) {
    const alias = makeAlias();
    const result = await execute(alias, input, CONSENT_POLICY_VERSION);

    if (!result.error) {
      return { alias };
    }

    if (result.error.code !== "23505") {
      throw new Error("ONBOARDING_WRITE_FAILED");
    }
  }

  throw new Error("ALIAS_GENERATION_FAILED");
}
