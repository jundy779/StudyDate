/**
 * Owner helper: backup CONTACT_REVEAL_ENCRYPTION_KEY outside Git.
 * Never prints the key. Writes a local vault file with User-only ACL.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, ".env.local");
const raw = fs.readFileSync(envPath, "utf8");

function get(k) {
  const m = raw.match(new RegExp(`^${k}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const key = get("CONTACT_REVEAL_ENCRYPTION_KEY");
const version = get("CONTACT_REVEAL_KEY_VERSION") || "1";
if (!key || key.length < 32) {
  console.error(JSON.stringify({ ok: false, error: "KEY_MISSING_OR_TOO_SHORT" }));
  process.exit(1);
}

const vaultDir = path.join(os.homedir(), "StudyDate-Vault");
fs.mkdirSync(vaultDir, { recursive: true });

// cleanup failed DPAPI temps if any
for (const name of ["_encrypt-temp.ps1", "_verify-temp.ps1", "_payload-temp.txt"]) {
  try {
    fs.unlinkSync(path.join(vaultDir, name));
  } catch {
    /* ignore */
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const secretPath = path.join(vaultDir, `contact-reveal-backup-${stamp}.env`);
const latestSecret = path.join(vaultDir, "contact-reveal-backup-LATEST.env");
const metaPath = path.join(vaultDir, `contact-reveal-backup-${stamp}.meta.json`);
const latestMeta = path.join(vaultDir, "contact-reveal-backup-LATEST.meta.json");
const readmePath = path.join(vaultDir, "README.txt");

const body = [
  "# StudyDate Contact Reveal key backup — DO NOT COMMIT / SHARE",
  `# createdAt=${new Date().toISOString()}`,
  `# hostUser=${os.userInfo().username}`,
  `CONTACT_REVEAL_ENCRYPTION_KEY=${key}`,
  `CONTACT_REVEAL_KEY_VERSION=${version}`,
  "",
].join("\n");

fs.writeFileSync(secretPath, body, { encoding: "utf8", mode: 0o600 });
fs.copyFileSync(secretPath, latestSecret);

// Restrict ACL to current Windows user only
const user = os.userInfo().username;
try {
  execFileSync(
    "icacls",
    [vaultDir, "/inheritance:r", `/grant:r`, `${user}:(OI)(CI)F`, "/T"],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  for (const p of [secretPath, latestSecret]) {
    execFileSync("icacls", [p, "/inheritance:r", `/grant:r`, `${user}:F`], {
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
} catch (err) {
  console.error(
    JSON.stringify({
      ok: false,
      error: "ACL_LOCK_FAILED",
      detail: String(err && err.message ? err.message : err),
    }),
  );
  process.exit(1);
}

// Non-destructive restore check: read back without printing
const restored = fs.readFileSync(latestSecret, "utf8");
const restoredKey = getFromText(restored, "CONTACT_REVEAL_ENCRYPTION_KEY");
const restoredVer = getFromText(restored, "CONTACT_REVEAL_KEY_VERSION") || "1";
if (restoredKey !== key || restoredVer !== version) {
  console.error(JSON.stringify({ ok: false, error: "RESTORE_MISMATCH" }));
  process.exit(1);
}

function getFromText(text, k) {
  const m = text.match(new RegExp(`^${k}=(.*)$`, "m"));
  if (!m) return "";
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const meta = {
  createdAt: new Date().toISOString(),
  secretName: "CONTACT_REVEAL_ENCRYPTION_KEY",
  keyVersion: version,
  keyLengthChars: key.length,
  storage: "local file outside repo + Windows ACL (current user only)",
  vaultDir,
  secretFile: path.basename(latestSecret),
  restoreVerified: true,
  nextStep:
    "Copy values into Bitwarden/1Password (or org vault), then keep this folder as machine backup.",
  warning: "Jangan commit, chat, atau upload file .env ini.",
};

fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
fs.writeFileSync(latestMeta, JSON.stringify(meta, null, 2));
fs.writeFileSync(
  readmePath,
  [
    "StudyDate Vault — Contact Reveal key backup",
    "",
    "Lokasi di LUAR repo Git.",
    "File *.env berisi secret — ACL dikunci ke user Windows ini.",
    "",
    "Wajib:",
    "1) Salin CONTACT_REVEAL_ENCRYPTION_KEY + VERSION ke password manager Owner",
    "2) Jangan kirim lewat chat/email",
    "3) Prosedur: studydate-web/docs/operations/contact-reveal-key-recovery.md",
    "",
  ].join("\n"),
  "utf8",
);

console.log(
  JSON.stringify(
    {
      ok: true,
      vaultDir,
      keyVersion: version,
      keyLengthChars: key.length,
      secretFile: latestSecret,
      metaFile: latestMeta,
      restoreVerified: true,
      aclLockedToUser: user,
      printedKey: false,
    },
    null,
    2,
  ),
);
