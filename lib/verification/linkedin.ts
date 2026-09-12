import "server-only";

import { createServerAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createHmac } from "node:crypto";

const LINKEDIN_AUTHORIZATION_URL =
  "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL =
  "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_IDENTITY_URL =
  "https://api.linkedin.com/rest/identityMe";
const LINKEDIN_VERIFICATION_URL =
  "https://api.linkedin.com/rest/verificationReport";
const LINKEDIN_RESPONSE_LIMIT = 200_000;
export const LINKEDIN_STATE_COOKIE =
  "studydate_linkedin_verification_state";

type LinkedInConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  identityApiVersion: string;
  verificationApiVersion: string;
  memberHashKey: Buffer;
};

export type LinkedInVerificationStatus = {
  linked: true;
  identityVerified: boolean;
  workplaceVerified: boolean;
  checkedAt: string;
};

type LinkedInIdentityResponse = {
  id?: unknown;
};

type LinkedInVerificationResponse = {
  id?: unknown;
  verifications?: unknown;
};

function decodeMemberHashKey(value: string) {
  if (/^[0-9a-f]{64}$/i.test(value)) {
    return Buffer.from(value, "hex");
  }
  try {
    const decoded = Buffer.from(value, "base64");
    return decoded.length === 32 ? decoded : null;
  } catch {
    return null;
  }
}

function validApiVersion(value: string) {
  return /^\d{6}(?:\.\d{2})?$/.test(value);
}

export function getLinkedInConfig(): LinkedInConfig | null {
  if (process.env.LINKEDIN_VERIFICATION_ENABLED !== "true") return null;

  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI?.trim();
  const identityApiVersion =
    process.env.LINKEDIN_IDENTITY_API_VERSION?.trim();
  const verificationApiVersion =
    process.env.LINKEDIN_VERIFICATION_API_VERSION?.trim();
  const memberHashKeyValue =
    process.env.LINKEDIN_MEMBER_HASH_KEY?.trim();
  const memberHashKey = memberHashKeyValue
    ? decodeMemberHashKey(memberHashKeyValue)
    : null;

  if (
    !clientId ||
    !clientSecret ||
    !redirectUri?.startsWith("https://") ||
    !identityApiVersion ||
    !verificationApiVersion ||
    !validApiVersion(identityApiVersion) ||
    !validApiVersion(verificationApiVersion) ||
    !memberHashKey
  ) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    identityApiVersion,
    verificationApiVersion,
    memberHashKey,
  };
}

export function isLinkedInVerificationConfigured() {
  return getLinkedInConfig() !== null;
}

export function buildLinkedInAuthorizationUrl(
  config: LinkedInConfig,
  state: string,
) {
  const url = new URL(LINKEDIN_AUTHORIZATION_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set(
    "scope",
    "r_profile_basicinfo r_verify_details",
  );
  return url;
}

async function parseBoundedJson<T>(response: Response): Promise<T> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (
    !response.ok ||
    (Number.isFinite(declaredLength) &&
      declaredLength > LINKEDIN_RESPONSE_LIMIT)
  ) {
    throw new Error("LinkedIn request failed.");
  }
  const body = await response.text();
  if (!body || body.length > LINKEDIN_RESPONSE_LIMIT) {
    throw new Error("LinkedIn response unavailable.");
  }
  return JSON.parse(body) as T;
}

export async function exchangeLinkedInCode(
  config: LinkedInConfig,
  code: string,
) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });
  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await parseBoundedJson<{ access_token?: unknown }>(response);
  if (
    typeof payload.access_token !== "string" ||
    payload.access_token.length < 20
  ) {
    throw new Error("LinkedIn token unavailable.");
  }
  return payload.access_token;
}

async function fetchLinkedInJson<T>(
  url: string,
  accessToken: string,
  version: string,
) {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": version,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  return parseBoundedJson<T>(response);
}

export async function readLinkedInVerification(
  config: LinkedInConfig,
  accessToken: string,
) {
  const [identity, report] = await Promise.all([
    fetchLinkedInJson<LinkedInIdentityResponse>(
      LINKEDIN_IDENTITY_URL,
      accessToken,
      config.identityApiVersion,
    ),
    fetchLinkedInJson<LinkedInVerificationResponse>(
      LINKEDIN_VERIFICATION_URL,
      accessToken,
      config.verificationApiVersion,
    ),
  ]);
  if (
    typeof identity.id !== "string" ||
    typeof report.id !== "string" ||
    identity.id !== report.id ||
    identity.id.length > 200 ||
    !Array.isArray(report.verifications)
  ) {
    throw new Error("LinkedIn verification response invalid.");
  }

  const categories = new Set(
    report.verifications.filter(
      (item): item is string => typeof item === "string",
    ),
  );
  return {
    memberIdHash: createHmac("sha256", config.memberHashKey)
      .update(identity.id)
      .digest("hex"),
    identityVerified: categories.has("IDENTITY"),
    workplaceVerified: categories.has("WORKPLACE"),
  };
}

export async function saveLinkedInVerification(
  userId: string,
  result: {
    memberIdHash: string;
    identityVerified: boolean;
    workplaceVerified: boolean;
  },
) {
  const admin = createServerAdminClient();
  if (!admin) throw new Error("LinkedIn verification storage unavailable.");

  const { error } = await admin.from("linkedin_verification_links").upsert(
    {
      user_id: userId,
      member_id_hash: result.memberIdHash,
      identity_verified: result.identityVerified,
      workplace_verified: result.workplaceVerified,
      checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error("LinkedIn verification storage failed.");
}

export async function getLinkedInVerificationStatus(
  userId: string,
): Promise<LinkedInVerificationStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("linkedin_verification_links")
    .select("identity_verified, workplace_verified, checked_at")
    .eq("user_id", userId)
    .maybeSingle<{
      identity_verified: boolean;
      workplace_verified: boolean;
      checked_at: string;
    }>();

  if (error || !data) return null;
  return {
    linked: true,
    identityVerified: data.identity_verified,
    workplaceVerified: data.workplace_verified,
    checkedAt: data.checked_at,
  };
}
