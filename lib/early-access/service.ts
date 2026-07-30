import {
  earlyAccessPayloadSchema,
  getEarlyAccessFieldErrors,
  type EarlyAccessFieldErrors,
  type EarlyAccessSource,
} from "./validation";

export type WaitlistEntry = {
  email: string;
  campus: string | null;
  interests: string[];
  source: EarlyAccessSource;
  status: "waiting";
  consent_version: "v1";
  consented_at: string;
};

type InsertError = {
  code?: string;
};

export type InsertWaitlistEntry = (
  entry: WaitlistEntry,
) => Promise<{ error: InsertError | null }>;

export type EarlyAccessServiceResult =
  | { status: "success" }
  | { status: "duplicate" }
  | {
      status: "validation_error";
      fieldErrors: EarlyAccessFieldErrors;
      formError?: string;
    }
  | { status: "server_error" };

export async function submitEarlyAccess(
  input: unknown,
  insertEntry: InsertWaitlistEntry,
): Promise<EarlyAccessServiceResult> {
  const parsed = earlyAccessPayloadSchema.safeParse(input);

  if (!parsed.success) {
    return {
      status: "validation_error",
      fieldErrors: getEarlyAccessFieldErrors(parsed.error),
    };
  }

  if (parsed.data.website.trim()) {
    return {
      status: "validation_error",
      fieldErrors: {},
      formError: "Permintaan tidak dapat diproses.",
    };
  }

  try {
    const { error } = await insertEntry({
      email: parsed.data.email,
      campus: parsed.data.campus,
      interests: parsed.data.interests,
      source: parsed.data.source,
      status: "waiting",
      consent_version: "v1",
      consented_at: new Date().toISOString(),
    });

    if (!error) {
      return { status: "success" };
    }

    if (error.code === "23505") {
      return { status: "duplicate" };
    }

    return { status: "server_error" };
  } catch {
    return { status: "server_error" };
  }
}
