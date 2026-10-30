import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");
const migration = read("supabase/migrations/202610300002_owner_event_feature_switches_v1.sql");
const switches = read("lib/events/feature-switches.ts");
const action = read("app/owner/events/actions.ts");
const panel = read("components/events/owner-event-feature-switches.tsx");
const page = read("app/owner/events/page.tsx");
const audit = read("app/owner/audit/page.tsx");

test("event feature switches default off and only Owner can change them", () => {
  assert.match(migration, /\('event_blast_enabled', false\), \('event_email_enabled', false\)/);
  assert.match(migration, /owner_set_event_feature_switch[\s\S]*is_current_active_staff\(array\['owner'\]::text\[\], false\)/);
  assert.match(migration, /p_key not in \('event_blast_enabled', 'event_email_enabled'\)/);
  assert.match(migration, /revoke all on function public\.get_event_feature_switches\(\) from public, anon/);
  assert.match(migration, /insert into public\.staff_ops_audit_events/);
});

test("both the env permission and the Owner switch must be on", () => {
  assert.match(switches, /if \(!eventBlastPermitted\(\)\) return false;/);
  assert.match(switches, /return \(await getEventFeatureSwitches\(\)\)\.blast;/);
  assert.match(switches, /if \(!\(await isEventBlastEnabled\(\)\)\) return false;/);
  assert.match(switches, /available: false, blast: false, email: false/);
});

test("Owner cannot switch on a feature whose requirements are missing", () => {
  assert.match(action, /await requireOwner\(\);[\s\S]*setEventFeatureSwitchAction|setEventFeatureSwitchAction[\s\S]*await requireOwner\(\)/);
  assert.match(action, /state=feature_not_ready/);
  assert.match(action, /ownerSetEventFeatureSwitch\("event_email_enabled", false\)/);
  assert.match(panel, /disabled=\{!ready\}/);
  assert.match(page, /<OwnerEventFeatureSwitches readiness=\{featureReadiness\} \/>/);
  assert.match(audit, /event_email_enabled: "Email pengumuman acara dinyalakan"/);
});
