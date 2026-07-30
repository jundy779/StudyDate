import { NextResponse, type NextRequest } from "next/server";
import { consumeEarlyAccessAttempt } from "@/lib/early-access/rate-limit";
import { submitEarlyAccess } from "@/lib/early-access/service";
import { createWaitlistAdminClient } from "@/lib/supabase/admin";

const MAX_PAYLOAD_BYTES = 4_096;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return jsonResponse(
      { status: "validation_error", formError: "Format permintaan tidak valid." },
      415,
    );
  }

  const declaredLength = Number(request.headers.get("content-length") || "0");

  if (declaredLength > MAX_PAYLOAD_BYTES) {
    return jsonResponse(
      { status: "validation_error", formError: "Permintaan terlalu besar." },
      413,
    );
  }

  if (!consumeEarlyAccessAttempt(request)) {
    return jsonResponse(
      {
        status: "server_error",
        formError: "Terlalu banyak percobaan. Silakan coba lagi nanti.",
      },
      429,
    );
  }

  const rawBody = await request.text();

  if (new TextEncoder().encode(rawBody).byteLength > MAX_PAYLOAD_BYTES) {
    return jsonResponse(
      { status: "validation_error", formError: "Permintaan terlalu besar." },
      413,
    );
  }

  let input: unknown;

  try {
    input = JSON.parse(rawBody);
  } catch {
    return jsonResponse(
      { status: "validation_error", formError: "Format permintaan tidak valid." },
      400,
    );
  }

  const result = await submitEarlyAccess(input, async (entry) => {
    const supabase = createWaitlistAdminClient();

    if (!supabase) {
      return { error: { code: "CONFIGURATION_UNAVAILABLE" } };
    }

    const { error } = await supabase.from("early_access_waitlist").insert(entry);
    return { error: error ? { code: error.code } : null };
  });

  if (result.status === "validation_error") {
    return jsonResponse(result, 400);
  }

  if (result.status === "server_error") {
    return jsonResponse(
      {
        status: "server_error",
        formError:
          "Pendaftaran belum dapat diproses. Silakan coba lagi beberapa saat.",
      },
      503,
    );
  }

  return jsonResponse(result, 200);
}
