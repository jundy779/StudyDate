import { createHash } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";
import { consumeEarlyAccessAttempt } from "@/lib/early-access/rate-limit";
import { earlyAccessRevisionPayloadSchema } from "@/lib/early-access/validation";
import { createWaitlistAdminClient } from "@/lib/supabase/admin";

const MAX_PAYLOAD_BYTES = 4_096;

function response(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return response({ ok: false, error: "Format permintaan tidak valid." }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") || "0");
  if (declaredLength > MAX_PAYLOAD_BYTES) {
    return response({ ok: false, error: "Permintaan terlalu besar." }, 413);
  }
  if (!(await consumeEarlyAccessAttempt(request))) {
    return response({ ok: false, error: "Terlalu banyak percobaan. Coba lagi nanti." }, 429);
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) {
    return response({ ok: false, error: "Permintaan terlalu besar." }, 413);
  }

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch {
    return response({ ok: false, error: "Format permintaan tidak valid." }, 400);
  }

  const parsed = earlyAccessRevisionPayloadSchema.safeParse(input);
  if (!parsed.success || parsed.data.website.trim()) {
    return response({ ok: false, error: "Periksa kembali data yang kamu isi." }, 400);
  }

  const admin = createWaitlistAdminClient();
  if (!admin) {
    return response({ ok: false, error: "Perbaikan belum dapat diproses." }, 503);
  }

  const tokenHash = hashToken(parsed.data.token);
  const { data: entry, error: readError } = await admin
    .from("early_access_waitlist")
    .select("id,status,revision_token_expires_at")
    .eq("revision_token_hash", tokenHash)
    .eq("status", "needs_revision")
    .maybeSingle();

  if (
    readError ||
    !entry ||
    !entry.revision_token_expires_at ||
    new Date(entry.revision_token_expires_at).getTime() <= Date.now()
  ) {
    return response(
      { ok: false, error: "Tautan perbaikan tidak valid atau sudah kedaluarsa." },
      400,
    );
  }

  const { data: updated, error: updateError } = await admin
    .from("early_access_waitlist")
    .update({
      email: parsed.data.email,
      campus: parsed.data.campus,
      interests: parsed.data.interests,
      status: "waiting",
      revision_token_hash: null,
      revision_token_expires_at: null,
      resubmitted_at: new Date().toISOString(),
      invitation_sent_at: null,
    })
    .eq("id", entry.id)
    .eq("status", "needs_revision")
    .eq("revision_token_hash", tokenHash)
    .select("id")
    .maybeSingle();

  if (updateError?.code === "23505") {
    return response(
      { ok: false, error: "Email tersebut sudah digunakan pada pendaftaran lain." },
      409,
    );
  }
  if (updateError || !updated) {
    return response({ ok: false, error: "Perbaikan belum dapat disimpan." }, 409);
  }

  return response({ ok: true }, 200);
}
