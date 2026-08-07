/**
 * Targeted Owner/Admin Identity Reveal isolation audit.
 * Uses existing active staff_members only — never creates privileged accounts.
 *
 *   node scripts/identity-reveal-staff-session-audit.mjs
 *
 * Never logs emails, full UUIDs, tokens, first names, or Storage paths.
 */
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const projectRoot = process.cwd();
const EXPECTED_PROJECT_REF = "ctbqudtvrfezuoqcecyj";
const artifactDir = join(projectRoot, "audit-artifacts");
const reportPath = join(
  artifactDir,
  "identity-reveal-staff-session-report.json",
);
const studentAccountsPath = join(
  artifactDir,
  "identity-reveal-audit-accounts.json",
);

mkdirSync(artifactDir, { recursive: true });

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

function assertLinkedProjectRef(env) {
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error("REFUSING: NEXT_PUBLIC_SUPABASE_URL is not a valid URL");
  }
  const ref = host.split(".")[0] ?? "";
  if (ref !== EXPECTED_PROJECT_REF) {
    throw new Error(
      "REFUSING: project ref mismatch (expected StudyDate linked project)",
    );
  }
}

function suffix(id) {
  return String(id).slice(-8);
}

function log(label, detail = "") {
  console.log(detail ? `${label} ${detail}` : label);
}

function scanStaffRoutesForRevealUi() {
  const roots = [
    join(projectRoot, "app", "owner"),
    join(projectRoot, "app", "admin"),
    join(projectRoot, "app", "staff"),
  ];
  const hits = [];
  function walkSync(dir) {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        walkSync(full);
        continue;
      }
      if (!/\.(tsx|ts|jsx|js)$/.test(name)) continue;
      const text = readFileSync(full, "utf8");
      if (
        /identity.?reveal|IdentityReveal|identity-reveal|counterpart_first_name|photo_object_key/i.test(
          text,
        )
      ) {
        hits.push(full.replace(projectRoot, "").replace(/\\/g, "/"));
      }
    }
  }
  for (const root of roots) walkSync(root);
  return hits;
}

async function sessionFor(env, publishable, admin, email) {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${env.NEXT_PUBLIC_SITE_URL || "http://localhost:3010"}/auth/callback`,
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

async function main() {
  assert.notEqual(
    process.env.STUDENT_VERIFICATION_ENABLED,
    "true",
    "Student Verification must stay disabled",
  );

  const env = loadEnvLocal();
  assertLinkedProjectRef(env);
  assert.notEqual(env.STUDENT_VERIFICATION_ENABLED, "true");

  const publishable =
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.ok(publishable);
  assert.ok(env.SUPABASE_SERVICE_ROLE_KEY);

  const admin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const report = {
    verificationDisabled: true,
    projectRefOk: true,
    noStaffRevealBrowseUi: false,
    staffRouteHits: [],
    ownerSessionAvailable: false,
    adminSessionAvailable: false,
    ownerCannotGetAbState: null,
    adminCannotGetAbState: null,
    ownerCannotSelect: null,
    adminCannotSelect: null,
    ownerCannotPreview: null,
    adminCannotPreview: null,
    ownerCannotCompleted: null,
    adminCannotCompleted: null,
    ownerCannotResolvePhoto: null,
    adminCannotResolvePhoto: null,
    ownerCannotRegister: null,
    adminCannotRegister: null,
    sensitiveLeakInStaffResponses: false,
    limitations: [],
  };

  const routeHits = scanStaffRoutesForRevealUi();
  report.staffRouteHits = routeHits;
  report.noStaffRevealBrowseUi = routeHits.length === 0;
  assert.equal(report.noStaffRevealBrowseUi, true);
  log("PASS", "no owner/admin/staff Identity Reveal browse UI");

  const { data: staffRows, error: staffError } = await admin
    .from("staff_members")
    .select("user_id,role,status,verification_reviewer")
    .eq("status", "active");
  if (staffError) {
    throw new Error(`staff_members query failed: ${staffError.code ?? "error"}`);
  }

  const owners = (staffRows ?? []).filter((row) => row.role === "owner");
  const admins = (staffRows ?? []).filter((row) => row.role === "admin");

  if (!owners.length) {
    report.limitations.push("No active Owner staff_members row available");
  }
  if (!admins.length) {
    report.limitations.push("No active Admin staff_members row available");
  }

  let publicId = null;
  if (existsSync(studentAccountsPath)) {
    // Prefer a live synthetic conversation if one still exists for retained accounts.
    const accounts = JSON.parse(readFileSync(studentAccountsPath, "utf8"));
    const aId = accounts.A?.id;
    const bId = accounts.B?.id;
    if (aId && bId) {
      const { data: shells } = await admin
        .from("conversation_shells")
        .select("public_id,status,identity_revealed_at")
        .or(
          `and(participant_sender_id.eq.${aId},participant_recipient_id.eq.${bId}),and(participant_sender_id.eq.${bId},participant_recipient_id.eq.${aId})`,
        )
        .limit(1);
      publicId = shells?.[0]?.public_id ?? null;
    }
  }

  if (!publicId) {
    // Use any recent shell only as an opaque public_id probe target for outsider denial.
    const { data: anyShell } = await admin
      .from("conversation_shells")
      .select("public_id")
      .limit(1)
      .maybeSingle();
    publicId = anyShell?.public_id ?? null;
  }

  if (!publicId) {
    report.limitations.push(
      "No conversation public_id available to probe staff outsider denial",
    );
  }

  async function probeStaff(kind, userId) {
    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(userId);
    if (userError || !userData?.user?.email) {
      report.limitations.push(`${kind} Auth user/email unavailable`);
      return null;
    }

    const client = await sessionFor(
      env,
      publishable,
      admin,
      userData.user.email,
    );
    log("STAFF_SESSION", `kind=${kind} suffix=${suffix(userId)}`);

    const result = {
      stateDeniedOrEmpty: false,
      selectDenied: false,
      previewEmpty: false,
      completedEmpty: false,
      resolveDenied: false,
      registerDenied: false,
      responseFieldNames: [],
    };

    if (publicId) {
      const state = await client.rpc("get_identity_reveal_state", {
        p_public_id: publicId,
      });
      const row = (state.data ?? [])[0] ?? null;
      result.responseFieldNames = row ? Object.keys(row).sort() : [];
      const hasSensitive =
        result.responseFieldNames.some((key) =>
          /counterpart|photo|object_key|uuid|email|nim|legal/i.test(key),
        ) ||
        Boolean(row?.counterpart_first_name) ||
        Boolean(row?.mine_first_name);
      if (hasSensitive) report.sensitiveLeakInStaffResponses = true;

      // Staff are not conversation participants: expect non-eligible empty-safe state.
      result.stateDeniedOrEmpty =
        Boolean(state.error) ||
        !row ||
        (row.eligible === false &&
          row.has_profile === false &&
          row.selected_by_me === false &&
          row.completed === false);

      const select = await client.rpc("select_identity_reveal", {
        p_public_id: publicId,
        p_profile_version_id: "00000000-0000-4000-8000-000000000001",
      });
      result.selectDenied = Boolean(select.error);

      const preview = await client.rpc("get_identity_reveal_profile_preview", {
        p_public_id: publicId,
      });
      result.previewEmpty =
        Boolean(preview.error) || !(preview.data ?? [])[0]?.profile_version_id;

      const completed = await client.rpc("get_completed_identity_reveal", {
        p_public_id: publicId,
      });
      const completedRow = (completed.data ?? [])[0] ?? null;
      result.completedEmpty =
        Boolean(completed.error) ||
        !completedRow ||
        completedRow.completed !== true;

      const resolve = await client.rpc("resolve_identity_reveal_photo_key", {
        p_public_id: publicId,
        p_viewer_user_id: userId,
        p_which: "counterpart",
      });
      result.resolveDenied =
        Boolean(resolve.error) || !(resolve.data ?? [])[0]?.photo_object_key;

      const register = await client.rpc(
        "register_identity_reveal_profile_version",
        {
          p_public_id: publicId,
          p_owner_user_id: userId,
          p_first_name: "AuditStaff",
          p_photo_object_key: "probe/denied.jpg",
          p_photo_content_type: "image/jpeg",
          p_photo_byte_size: 100,
          p_photo_width: 128,
          p_photo_height: 128,
        },
      );
      result.registerDenied = Boolean(register.error);
    }

    await client.auth.signOut().catch(() => undefined);
    return result;
  }

  if (owners[0]?.user_id) {
    report.ownerSessionAvailable = true;
    const ownerProbe = await probeStaff("owner", owners[0].user_id);
    if (ownerProbe) {
      report.ownerCannotGetAbState = ownerProbe.stateDeniedOrEmpty;
      report.ownerCannotSelect = ownerProbe.selectDenied;
      report.ownerCannotPreview = ownerProbe.previewEmpty;
      report.ownerCannotCompleted = ownerProbe.completedEmpty;
      report.ownerCannotResolvePhoto = ownerProbe.resolveDenied;
      report.ownerCannotRegister = ownerProbe.registerDenied;
    }
  }

  if (admins[0]?.user_id) {
    report.adminSessionAvailable = true;
    const adminProbe = await probeStaff("admin", admins[0].user_id);
    if (adminProbe) {
      report.adminCannotGetAbState = adminProbe.stateDeniedOrEmpty;
      report.adminCannotSelect = adminProbe.selectDenied;
      report.adminCannotPreview = adminProbe.previewEmpty;
      report.adminCannotCompleted = adminProbe.completedEmpty;
      report.adminCannotResolvePhoto = adminProbe.resolveDenied;
      report.adminCannotRegister = adminProbe.registerDenied;
    }
  }

  if (report.ownerSessionAvailable) {
    assert.equal(report.ownerCannotGetAbState, true);
    assert.equal(report.ownerCannotSelect, true);
    assert.equal(report.ownerCannotPreview, true);
    assert.equal(report.ownerCannotCompleted, true);
    assert.equal(report.ownerCannotResolvePhoto, true);
    assert.equal(report.ownerCannotRegister, true);
    log("PASS", "owner session outsider IR denial");
  } else {
    log("LIMIT", "owner session unavailable");
  }

  if (report.adminSessionAvailable) {
    assert.equal(report.adminCannotGetAbState, true);
    assert.equal(report.adminCannotSelect, true);
    assert.equal(report.adminCannotPreview, true);
    assert.equal(report.adminCannotCompleted, true);
    assert.equal(report.adminCannotResolvePhoto, true);
    assert.equal(report.adminCannotRegister, true);
    log("PASS", "admin session outsider IR denial");
  } else {
    log("LIMIT", "admin session unavailable");
  }

  assert.equal(report.sensitiveLeakInStaffResponses, false);

  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log("REPORT_WRITTEN", "audit-artifacts/identity-reveal-staff-session-report.json");

  if (!report.ownerSessionAvailable || !report.adminSessionAvailable) {
    log("IDENTITY_REVEAL_STAFF_SESSION_AUDIT_PARTIAL");
    process.exitCode = 0;
    return;
  }

  log("IDENTITY_REVEAL_STAFF_SESSION_AUDIT_COMPLETE");
}

main().catch((error) => {
  console.error(
    "IDENTITY_REVEAL_STAFF_SESSION_AUDIT_FAILED",
    String(error?.message ?? error).slice(0, 200),
  );
  process.exitCode = 1;
});
