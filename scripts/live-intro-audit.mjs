/**
 * Live Introduction Requests v1 audit against linked Supabase.
 * Uses Admin createUser + generateLink/verifyOtp (no inbox).
 * Never prints emails, full UUIDs, tokens, or magic links.
 *
 *   node scripts/live-intro-audit.mjs
 */
import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const projectRoot = process.cwd();
const artifactDir = join(projectRoot, "audit-artifacts");
const reportPath = join(artifactDir, "intro-live-report.json");
const accountsPath = join(artifactDir, "intro-audit-accounts.json");

mkdirSync(artifactDir, { recursive: true });

const results = {
  people: {},
  send: {},
  messages: {},
  accept: {},
  decline: {},
  cancel: {},
  limits: {},
  block: {},
  report: {},
  rls: {},
  cleanup: {},
  verificationDisabled: true,
};

function loadEnvLocal() {
  const env = {};
  for (const line of readFileSync(join(projectRoot, ".env.local"), "utf8").split(
    /\r?\n/,
  )) {
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    env[line.slice(0, index)] = line.slice(index + 1);
  }
  return env;
}

function adminBundle() {
  const env = loadEnvLocal();
  assert.ok(env.NEXT_PUBLIC_SUPABASE_URL);
  assert.ok(env.SUPABASE_SERVICE_ROLE_KEY);
  const publishable =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.ok(publishable);
  return {
    env,
    publishable,
    admin: createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    }),
  };
}

function suffix(id) {
  return String(id).slice(-8);
}

function log(label, detail = "") {
  console.log(detail ? `${label} ${detail}` : label);
}

async function ensureAccount(kind, accounts, admin) {
  if (accounts[kind]?.id) {
    const { data } = await admin.auth.admin.getUserById(accounts[kind].id);
    if (data?.user && !data.user.app_metadata?.role) {
      return accounts[kind];
    }
  }
  const stamp = `${Date.now()}.${randomInt(1000, 9999)}`;
  const email = `studydate.intro.${kind}.${stamp}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {},
    app_metadata: {},
  });
  if (error || !data.user) throw new Error(`createUser ${kind} failed`);
  if (data.user.app_metadata?.role) {
    throw new Error(`Refusing privileged account for ${kind}`);
  }
  accounts[kind] = {
    id: data.user.id,
    email,
    suffix: suffix(data.user.id),
  };
  writeFileSync(accountsPath, JSON.stringify(accounts, null, 2));
  log("ACCOUNT_READY", `kind=${kind} suffix=${accounts[kind].suffix}`);
  return accounts[kind];
}

async function sessionFor(email) {
  const { env, admin, publishable } = adminBundle();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${env.NEXT_PUBLIC_SITE_URL || "http://localhost:3010"}/auth/callback?next=/app`,
    },
  });
  if (error || !data?.properties?.hashed_token) {
    throw new Error("generateLink failed");
  }
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, publishable, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const verified = await client.auth.verifyOtp({
    type: "magiclink",
    token_hash: data.properties.hashed_token,
  });
  if (verified.error) throw new Error("verifyOtp failed");
  return client;
}

async function onboard(client, firstName) {
  const {
    data: { user },
  } = await client.auth.getUser();
  const { data: existing } = await client
    .from("profiles")
    .select("public_alias,onboarding_completed_at,is_discoverable")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing?.onboarding_completed_at) {
    return existing.public_alias;
  }
  const alias = `Partner #${randomInt(100000, 1000000)}`;
  const { error } = await client.rpc("complete_student_onboarding_v2", {
    p_public_alias: alias,
    p_first_name: firstName,
    p_nim_ciphertext: null,
    p_nim_iv: null,
    p_nim_auth_tag: null,
    p_nim_last_four: null,
    p_nim_fingerprint: null,
    p_campus: "Universitas Audit Intro",
    p_study_program: "Informatika",
    p_degree_level: "sarjana",
    p_semester: 4,
    p_city_region: "Bandung",
    p_short_intro: "Profil sintetik untuk uji perkenalan.",
    p_interests: ["technology", "design"],
    p_connection_goals: ["study", "friendship"],
    p_online_first: true,
    p_group_first: false,
    p_verified_users_only: false,
    p_same_campus_preferred: false,
    p_cross_campus_allowed: true,
    p_policy_version: "2026-07-30",
    p_terms_accepted: true,
    p_privacy_accepted: true,
    p_community_guidelines_accepted: true,
  });
  if (error) throw new Error(`onboarding failed: ${error.message}`);
  return alias;
}

async function setDiscoverable(client, value) {
  const { error } = await client.rpc("set_people_discovery_visibility", {
    p_is_discoverable: value,
  });
  if (error) throw new Error(`visibility failed: ${error.message}`);
}

async function aliasOf(client) {
  const {
    data: { user },
  } = await client.auth.getUser();
  const { data } = await client
    .from("profiles")
    .select("public_alias")
    .eq("user_id", user.id)
    .single();
  return data.public_alias;
}

function isContactError(error) {
  const message = (error?.message ?? "").toLowerCase();
  return (
    message.includes("contact disclosure") ||
    message.includes("invalid opening") ||
    message.includes("22023")
  );
}

async function main() {
  assert.notEqual(
    process.env.STUDENT_VERIFICATION_ENABLED,
    "true",
    "Student Verification must stay disabled for this audit",
  );
  const env = loadEnvLocal();
  results.verificationDisabled = env.STUDENT_VERIFICATION_ENABLED !== "true";

  const { admin } = adminBundle();
  let accounts = existsSync(accountsPath)
    ? JSON.parse(readFileSync(accountsPath, "utf8"))
    : {};

  const kinds = ["A", "B", "C", "D", "E", "F", "R1", "R2", "R3", "R4", "R5"];
  for (const kind of kinds) {
    accounts[kind] = await ensureAccount(kind, accounts, admin);
  }

  // Wipe leftover synthetic intro/block/report rows from prior audit runs.
  {
    const ids = kinds.map((kind) => accounts[kind].id);
    await admin.from("user_reports").delete().in("reporter_id", ids);
    await admin
      .from("user_blocks")
      .delete()
      .or(`blocker_id.in.(${ids.join(",")}),blocked_id.in.(${ids.join(",")})`);
    const { data: introRows } = await admin
      .from("introduction_requests")
      .select("id")
      .or(`sender_id.in.(${ids.join(",")}),recipient_id.in.(${ids.join(",")})`);
    const introIds = (introRows ?? []).map((row) => row.id);
    if (introIds.length) {
      await admin.from("introduction_events").delete().in("request_id", introIds);
      await admin
        .from("conversation_shells")
        .delete()
        .in("introduction_request_id", introIds);
      await admin.from("introduction_requests").delete().in("id", introIds);
    }
    log("PRECLEAN_OK", `intros=${introIds.length}`);
  }

  const sessions = {};
  const aliases = {};
  for (const kind of kinds) {
    const client = await sessionFor(accounts[kind].email);
    aliases[kind] = await onboard(client, `Intro${kind}`);
    await setDiscoverable(client, true);
    sessions[kind] = client;
    log("ONBOARDED", `kind=${kind} alias=${aliases[kind]}`);
  }

  // --- People eligibility ---
  {
    const { data: listA, error } = await sessions.A.rpc(
      "list_people_discovery_profiles",
      { p_limit: 13 },
    );
    assert.ifError(error);
    const { data: listB, error: listBError } = await sessions.B.rpc(
      "list_people_discovery_profiles",
      { p_limit: 13 },
    );
    assert.ifError(listBError);
    const aliasesFound = (listA ?? []).map((row) => row.public_alias);
    const aliasesFoundB = (listB ?? []).map((row) => row.public_alias);
    const seesB = aliasesFound.includes(aliases.B);
    const seesA = aliasesFoundB.includes(aliases.A);
    const seesSelf = aliasesFound.includes(aliases.A);
    const hasUuid = JSON.stringify(listA).includes(accounts.B.id);
    await setDiscoverable(sessions.B, false);
    const { data: listHidden } = await sessions.A.rpc(
      "list_people_discovery_profiles",
      { p_limit: 13 },
    );
    const hiddenStillVisible = (listHidden ?? []).some(
      (row) => row.public_alias === aliases.B,
    );
    await setDiscoverable(sessions.B, true);
    results.people = {
      aSeesB: seesB,
      bSeesA: seesA,
      aSeesSelf: seesSelf,
      hiddenExcluded: !hiddenStillVisible,
      uuidExposed: hasUuid,
      sampleFields: listA?.[0]
        ? Object.keys(listA[0]).sort()
        : [],
    };
    assert.equal(seesB, true);
    assert.equal(seesA, true);
    assert.equal(seesSelf, false);
    assert.equal(hiddenStillVisible, false);
    assert.equal(hasUuid, false);
    assert.deepEqual(
      results.people.sampleFields.filter((field) =>
        ["first_name", "email", "user_id", "nim"].includes(field),
      ),
      [],
    );
    log(
      "PEOPLE_OK",
      `aSeesB=${seesB} bSeesA=${seesA} selfExcluded=${!seesSelf} hiddenExcluded=${!hiddenStillVisible}`,
    );
  }

  // --- Message validation ---
  {
    // Ensure no leftover pending pair interferes with negative cases.
    const { data: priorSent } = await sessions.A.rpc(
      "list_sent_introduction_requests",
      { p_limit: 50 },
    );
    for (const row of priorSent ?? []) {
      if (row.status === "pending") {
        await sessions.A.rpc("cancel_introduction_request", {
          p_request_id: row.request_id,
        });
      }
    }

    const cases = [
      ["short", "halo saja", true, "R1"],
      ["whitespace", "           ", true, "R1"],
      ["long", "x".repeat(301), true, "R1"],
      ["email", "hubungi aku di nama@kampus.ac.id ya", true, "R1"],
      ["phone", "nomor whatsapp 081234567890 dong", true, "R1"],
      ["telegram", "telegram @belajarbersama yuk", true, "R1"],
      ["url", "cek https://wa.me/6281234567890 dulu", true, "R1"],
      // HTML without contact is escaped in UI; DB may accept plain text.
      ["html", "<b>belajar desain bareng yuk nih</b>", false, "R2"],
      ["markdown_link", "**bold** dan https://example.com minat desain", true, "R1"],
      ["valid", "Halo, aku tertarik belajar desain UI bareng.", false, "R3"],
    ];
    const messageResults = {};
    for (const [name, message, expectFail, recipientKind] of cases) {
      const { data, error } = await sessions.A.rpc("send_introduction_request", {
        p_recipient_alias: aliases[recipientKind],
        p_opening_message: message,
      });
      const failed = Boolean(error);
      messageResults[name] = {
        failed,
        expectedFail: expectFail,
        ok: failed === expectFail,
        code: error?.code ?? null,
      };
      if (!expectFail && !error && data) {
        await sessions.A.rpc("cancel_introduction_request", {
          p_request_id: data,
        });
      }
    }
    results.messages = messageResults;
    assert.ok(
      Object.values(messageResults).every((row) => row.ok),
      JSON.stringify(messageResults),
    );
    log("MESSAGE_RULES_OK");
  }

  // --- Send + lists ---
  let acceptRequestId = null;
  {
    const { data: requestId, error } = await sessions.A.rpc(
      "send_introduction_request",
      {
        p_recipient_alias: aliases.B,
        p_opening_message:
          "Hai, aku ingin berkenalan soal minat desain dan belajar bersama.",
      },
    );
    assert.ifError(error);
    acceptRequestId = requestId;
    const { error: dupError } = await sessions.A.rpc("send_introduction_request", {
      p_recipient_alias: aliases.B,
      p_opening_message: "Pesan kedua yang seharusnya ditolak sebagai duplikat.",
    });
    assert.ok(dupError, "duplicate pending must fail");

    const { data: eligibility, error: eligError } = await sessions.A.rpc(
      "get_introduction_send_eligibility",
      { p_recipient_alias: aliases.B },
    );
    const state = eligibility?.[0];
    const { data: sent, error: sentError } = await sessions.A.rpc(
      "list_sent_introduction_requests",
      { p_limit: 20 },
    );
    const { data: received, error: receivedError } = await sessions.B.rpc(
      "list_received_introduction_requests",
      { p_limit: 20 },
    );
    assert.ifError(eligError);
    assert.ifError(sentError);
    assert.ifError(receivedError);
    const sentRow = (sent ?? []).find(
      (row) => String(row.request_id) === String(acceptRequestId),
    );
    const receivedRow = (received ?? []).find(
      (row) => String(row.request_id) === String(acceptRequestId),
    );
    const projection = JSON.stringify({ sentRow, receivedRow });
    results.send = {
      created: Boolean(acceptRequestId),
      requestIdType: typeof acceptRequestId,
      sentCount: (sent ?? []).length,
      receivedCount: (received ?? []).length,
      sentStatuses: (sent ?? []).map((row) => row.status),
      duplicateRejected: Boolean(dupError),
      eligibilityState: state?.state_code ?? null,
      eligibilityPending: state?.state_code === "pending",
      aSeesSent: sentRow?.status === "pending",
      bSeesReceived: receivedRow?.status === "pending",
      uuidLeak:
        projection.includes(accounts.A.id) || projection.includes(accounts.B.id),
      privateFieldsLeak: /first_name|legal_name|"email"|nim/i.test(projection),
    };
    assert.equal(results.send.aSeesSent, true, JSON.stringify(results.send));
    assert.equal(results.send.bSeesReceived, true, JSON.stringify(results.send));
    assert.equal(results.send.uuidLeak, false);
    assert.equal(results.send.privateFieldsLeak, false);
    log("SEND_OK", `dup=${results.send.duplicateRejected}`);
  }

  // --- Accept ---
  {
    const { error } = await sessions.B.rpc("accept_introduction_request", {
      p_request_id: acceptRequestId,
    });
    assert.ifError(error);
    const { error: again } = await sessions.B.rpc("accept_introduction_request", {
      p_request_id: acceptRequestId,
    });
    assert.ok(again, "second accept must fail");
    const { error: senderAccept } = await sessions.A.rpc(
      "accept_introduction_request",
      { p_request_id: acceptRequestId },
    );
    assert.ok(senderAccept, "sender cannot accept");

    const { data: shells, error: shellError } = await admin
      .from("conversation_shells")
      .select("id,status,introduction_request_id")
      .eq("introduction_request_id", acceptRequestId);
    assert.ifError(shellError);
    const { data: sent } = await sessions.A.rpc("list_sent_introduction_requests", {
      p_limit: 20,
    });
    const row = (sent ?? []).find((item) => item.request_id === acceptRequestId);
    results.accept = {
      status: row?.status,
      shellCount: shells?.length ?? 0,
      shellStatus: shells?.[0]?.status ?? null,
      secondAcceptRejected: Boolean(again),
      senderAcceptRejected: Boolean(senderAccept),
      noComposerFields: !/composer|message_body|chat_open/i.test(
        JSON.stringify(row),
      ),
    };
    assert.equal(results.accept.status, "accepted");
    assert.equal(results.accept.shellCount, 1);
    assert.equal(results.accept.shellStatus, "awaiting_chat");
    log("ACCEPT_OK");
  }

  // --- Decline (A → D) ---
  {
    const { data: requestId, error } = await sessions.A.rpc(
      "send_introduction_request",
      {
        p_recipient_alias: aliases.D,
        p_opening_message: "Perkenalan uji untuk alur penolakan yang aman.",
      },
    );
    assert.ifError(error);
    const { error: senderDecline } = await sessions.A.rpc(
      "decline_introduction_request",
      { p_request_id: requestId },
    );
    assert.ok(senderDecline, "sender cannot decline");
    const { error: declineError } = await sessions.D.rpc(
      "decline_introduction_request",
      { p_request_id: requestId },
    );
    assert.ifError(declineError);
    const { data: shells } = await admin
      .from("conversation_shells")
      .select("id")
      .eq("introduction_request_id", requestId);
    const { error: resend } = await sessions.A.rpc("send_introduction_request", {
      p_recipient_alias: aliases.D,
      p_opening_message: "Coba kirim ulang setelah ditolak seharusnya cooldown.",
    });
    results.decline = {
      senderDeclineRejected: Boolean(senderDecline),
      declined: !declineError,
      noShell: (shells?.length ?? 0) === 0,
      cooldownBlocksResend: Boolean(resend),
    };
    assert.equal(results.decline.noShell, true);
    assert.equal(results.decline.cooldownBlocksResend, true);
    log("DECLINE_OK");
  }

  // --- Cancel (A → E) ---
  {
    const { data: requestId, error } = await sessions.A.rpc(
      "send_introduction_request",
      {
        p_recipient_alias: aliases.E,
        p_opening_message: "Perkenalan uji untuk alur pembatalan oleh pengirim.",
      },
    );
    assert.ifError(error);
    const { error: recipientCancel } = await sessions.E.rpc(
      "cancel_introduction_request",
      { p_request_id: requestId },
    );
    assert.ok(recipientCancel, "recipient cannot cancel");
    const { error: cancelError } = await sessions.A.rpc(
      "cancel_introduction_request",
      { p_request_id: requestId },
    );
    assert.ifError(cancelError);
    const { error: cancelAccepted } = await sessions.A.rpc(
      "cancel_introduction_request",
      { p_request_id: acceptRequestId },
    );
    assert.ok(cancelAccepted, "accepted cannot cancel");
    const { error: resend } = await sessions.A.rpc("send_introduction_request", {
      p_recipient_alias: aliases.E,
      p_opening_message: "Kirim ulang setelah batal harus kena cooldown.",
    });
    results.cancel = {
      recipientCancelRejected: Boolean(recipientCancel),
      cancelled: !cancelError,
      acceptedCancelRejected: Boolean(cancelAccepted),
      cooldownBlocksResend: Boolean(resend),
    };
    assert.equal(results.cancel.cooldownBlocksResend, true);
    log("CANCEL_OK");
  }

  // --- Pending outgoing limit (max 5) using fresh sender C to avoid A's hourly quota ---
  {
    const recipients = ["R1", "R2", "R3", "R4", "R5"];
    const pendingIds = [];
    for (const kind of recipients) {
      const { data, error } = await sessions.C.rpc("send_introduction_request", {
        p_recipient_alias: aliases[kind],
        p_opening_message: `Pesan uji pending ${kind} agar batas antrian teruji.`,
      });
      assert.ifError(error);
      pendingIds.push(data);
    }
    const { error: sixth } = await sessions.C.rpc("send_introduction_request", {
      p_recipient_alias: aliases.F,
      p_opening_message: "Pesan keenam harus ditolak karena batas pending keluar.",
    });
    assert.ok(sixth, "6th pending outgoing must fail");
    for (const id of pendingIds) {
      await sessions.C.rpc("cancel_introduction_request", { p_request_id: id });
    }
    results.limits = {
      maxPendingOutgoingEnforced: Boolean(sixth),
      cancelledAfterProbe: pendingIds.length,
      hourDayLimits:
        "covered by SQL constraints + pending probe; not fully exhausted live",
      expiryDays: 14,
    };
    log("LIMITS_OK", "pendingMax=5");
  }

  // --- Block (B → fresh path using D/E after decline/cancel cooldowns avoided) ---
  {
    // Use F as recipient for a clean pending, blocked by F against B.
    // Ensure no leftover pending between B and F.
    const { data: requestId, error } = await sessions.B.rpc(
      "send_introduction_request",
      {
        p_recipient_alias: aliases.F,
        p_opening_message: "Perkenalan sebelum blokir untuk uji penutupan pending.",
      },
    );
    assert.ifError(error);
    const { error: blockError } = await sessions.F.rpc("block_student_by_alias", {
      p_alias: aliases.B,
    });
    assert.ifError(blockError);
    const { data: received } = await sessions.F.rpc(
      "list_received_introduction_requests",
      { p_limit: 20 },
    );
    const stillVisible = (received ?? []).some(
      (row) => row.request_id === requestId && row.status === "pending",
    );
    const { error: bToF } = await sessions.B.rpc("send_introduction_request", {
      p_recipient_alias: aliases.F,
      p_opening_message: "Harus gagal karena sudah diblokir dua arah.",
    });
    const { error: fToB } = await sessions.F.rpc("send_introduction_request", {
      p_recipient_alias: aliases.B,
      p_opening_message: "Harus gagal karena sudah diblokir dua arah.",
    });
    const { data: people } = await sessions.B.rpc("list_people_discovery_profiles", {
      p_limit: 13,
    });
    const fVisible = (people ?? []).some((row) => row.public_alias === aliases.F);
    results.block = {
      pendingClosed: !stillVisible,
      bCannotSend: Boolean(bToF),
      fCannotSend: Boolean(fToB),
      peopleHidesBlocked: !fVisible,
    };
    assert.equal(results.block.bCannotSend, true);
    assert.equal(results.block.fCannotSend, true);
    log("BLOCK_OK");
  }

  // --- Report ---
  {
    const { data: requestId, error } = await sessions.D.rpc(
      "send_introduction_request",
      {
        p_recipient_alias: aliases.E,
        p_opening_message: "Perkenalan uji untuk alur laporan peserta yang valid.",
      },
    );
    assert.ifError(error);
    const { error: outsider } = await sessions.A.rpc("report_introduction_request", {
      p_request_id: requestId,
      p_reason_code: "spam",
      p_details: null,
    });
    assert.ok(outsider, "non-participant cannot report");
    const { error: reportError } = await sessions.E.rpc(
      "report_introduction_request",
      {
        p_request_id: requestId,
        p_reason_code: "spam",
        p_details: "Pesan terasa berulang dan tidak relevan.",
      },
    );
    assert.ifError(reportError);
    const { data: reports } = await admin
      .from("user_reports")
      .select("reason_code,details,introduction_request_id")
      .eq("introduction_request_id", requestId);
    results.report = {
      outsiderRejected: Boolean(outsider),
      reported: !reportError,
      count: reports?.length ?? 0,
      reasonOk: reports?.[0]?.reason_code === "spam",
    };
    assert.equal(results.report.count, 1);
    log("REPORT_OK");
  }

  // --- RLS isolation ---
  {
    const { data: cReceived } = await sessions.C.rpc(
      "list_received_introduction_requests",
      { p_limit: 50 },
    );
    const seesAB = (cReceived ?? []).some(
      (row) => row.request_id === acceptRequestId,
    );
    const { error: forge } = await sessions.C.rpc("accept_introduction_request", {
      p_request_id: acceptRequestId,
    });
    const { data: directShell, error: shellInsertError } = await sessions.C.from(
      "conversation_shells",
    )
      .insert({
        introduction_request_id: acceptRequestId,
        participant_sender_id: accounts.A.id,
        participant_recipient_id: accounts.B.id,
        status: "awaiting_chat",
      })
      .select("id");
    results.rls = {
      cCannotSeeABAccept: !seesAB,
      cCannotAcceptAB: Boolean(forge),
      cCannotInsertShell:
        Boolean(shellInsertError) || (directShell?.length ?? 0) === 0,
    };
    assert.equal(results.rls.cCannotSeeABAccept, true);
    assert.equal(results.rls.cCannotAcceptAB, true);
    assert.equal(results.rls.cCannotInsertShell, true);
    log("RLS_OK");
  }

  // --- Cleanup synthetic rows (keep Auth accounts for optional browser pass) ---
  {
    const ids = kinds.map((kind) => accounts[kind].id);
    const delReports = await admin
      .from("user_reports")
      .delete()
      .in("reporter_id", ids);
    const delBlocks = await admin.from("user_blocks").delete().or(
      `blocker_id.in.(${ids.join(",")}),blocked_id.in.(${ids.join(",")})`,
    );
    const { data: introRows } = await admin
      .from("introduction_requests")
      .select("id")
      .or(`sender_id.in.(${ids.join(",")}),recipient_id.in.(${ids.join(",")})`);
    const introIds = (introRows ?? []).map((row) => row.id);
    if (introIds.length) {
      await admin.from("introduction_events").delete().in("request_id", introIds);
      await admin.from("conversation_shells").delete().in("introduction_request_id", introIds);
      await admin.from("introduction_requests").delete().in("id", introIds);
    }
    results.cleanup = {
      reportsError: delReports.error?.message ?? null,
      blocksError: delBlocks.error?.message ?? null,
      introductionsRemoved: introIds.length,
      accountsRetained: kinds.map((kind) => ({
        kind,
        suffix: accounts[kind].suffix,
      })),
      note: "Synthetic Auth users retained in audit-artifacts/intro-audit-accounts.json for optional browser follow-up; no real identities.",
    };
    log("CLEANUP_OK", `intros=${introIds.length}`);
  }

  for (const kind of kinds) {
    await sessions[kind].auth.signOut().catch(() => undefined);
  }

  writeFileSync(reportPath, JSON.stringify(results, null, 2));
  log("REPORT_WRITTEN", "audit-artifacts/intro-live-report.json");
  log("INTRO_LIVE_AUDIT_COMPLETE");
}

main().catch((error) => {
  console.error("INTRO_LIVE_AUDIT_FAILED", error.message);
  writeFileSync(
    reportPath,
    JSON.stringify({ failed: true, message: error.message, results }, null, 2),
  );
  process.exitCode = 1;
});
