import "server-only";

import {
  GENERIC_INTRODUCTION_ERROR,
  RATE_LIMIT_MESSAGE,
  CONTACT_DISCLOSURE_MESSAGE,
  type IntroductionStatus,
  type ReportReasonCode,
} from "@/lib/introductions/constants";
import { createClient } from "@/lib/supabase/server";

export type IntroductionListItem = {
  request_id: string;
  counterpart_alias: string;
  campus: string;
  study_program: string;
  semester: number | null;
  is_verified: boolean;
  opening_message: string;
  status: IntroductionStatus;
  created_at: string;
  responded_at: string | null;
};

export type IntroductionSendEligibility = {
  can_send: boolean;
  state_code:
    | "ok"
    | "self"
    | "unavailable"
    | "pending"
    | "cooldown"
    | "rate_limited"
    | "quota_reached"
    | "blocked";
};

function mapIntroductionError(message: string | undefined): string {
  const text = (message ?? "").toLowerCase();

  if (text.includes("contact disclosure")) {
    return CONTACT_DISCLOSURE_MESSAGE;
  }

  if (text.includes("quota reached")) {
    return "Kuota perkenalan paket kamu sudah terpakai. Lihat StudyDate Plus untuk kapasitas tambahan.";
  }

  if (
    text.includes("rate limited") ||
    text.includes("cooldown") ||
    text.includes("duplicate")
  ) {
    return RATE_LIMIT_MESSAGE;
  }

  if (text.includes("invalid opening")) {
    return "Tulis perkenalan singkat antara 12–300 karakter.";
  }

  return GENERIC_INTRODUCTION_ERROR;
}

export async function listReceivedIntroductions() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "list_received_introduction_requests",
    { p_limit: 50 },
  );

  if (error) {
    throw new Error(GENERIC_INTRODUCTION_ERROR);
  }

  return (data ?? []) as IntroductionListItem[];
}

export async function listSentIntroductions() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_sent_introduction_requests", {
    p_limit: 50,
  });

  if (error) {
    throw new Error(GENERIC_INTRODUCTION_ERROR);
  }

  return (data ?? []) as IntroductionListItem[];
}

export async function countPendingReceivedIntroductions() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "count_pending_received_introductions",
  );

  if (error) {
    return 0;
  }

  return typeof data === "number" ? data : 0;
}

export async function getIntroductionSendEligibility(alias: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_introduction_send_eligibility",
    { p_recipient_alias: alias },
  );

  if (error) {
    return {
      can_send: false,
      state_code: "unavailable",
    } satisfies IntroductionSendEligibility;
  }

  const row = (data ?? [])[0] as IntroductionSendEligibility | undefined;
  return (
    row ??
    ({
      can_send: false,
      state_code: "unavailable",
    } satisfies IntroductionSendEligibility)
  );
}

export async function sendIntroductionRequest(
  recipientAlias: string,
  openingMessage: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("send_introduction_request", {
    p_recipient_alias: recipientAlias,
    p_opening_message: openingMessage,
  });

  if (error) {
    throw new Error(mapIntroductionError(error.message));
  }
}

export async function acceptIntroductionRequest(requestId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_introduction_request", {
    p_request_id: requestId,
  });

  if (error) {
    throw new Error(mapIntroductionError(error.message));
  }
}

export async function declineIntroductionRequest(requestId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_introduction_request", {
    p_request_id: requestId,
  });

  if (error) {
    throw new Error(mapIntroductionError(error.message));
  }
}

export async function cancelIntroductionRequest(requestId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_introduction_request", {
    p_request_id: requestId,
  });

  if (error) {
    throw new Error(mapIntroductionError(error.message));
  }
}

export async function blockStudentByAlias(alias: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("block_student_by_alias", {
    p_alias: alias,
  });

  if (error) {
    throw new Error(GENERIC_INTRODUCTION_ERROR);
  }
}

export async function reportIntroductionRequest(
  requestId: string,
  reasonCode: ReportReasonCode,
  details?: string,
) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("report_introduction_request", {
    p_request_id: requestId,
    p_reason_code: reasonCode,
    p_details: details ?? null,
  });

  if (error) {
    throw new Error(mapIntroductionError(error.message));
  }
}
