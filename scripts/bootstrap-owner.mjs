import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("Server environment is not configured.");
}

const prompt = createInterface({ input, output });
const email = (await prompt.question("Owner Auth email: ")).trim().toLowerCase();
const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const matches = [];
for (let page = 1; ; page += 1) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
  if (error) throw new Error("Owner lookup failed.");
  matches.push(...data.users.filter((user) => user.email?.toLowerCase() === email));
  if (data.users.length < 1000) break;
}

if (matches.length !== 1) {
  throw new Error("Exactly one existing Auth user must match.");
}

const user = matches[0];
const [local, domain = ""] = email.split("@");
const maskedEmail = `${local.slice(0, 2)}${"*".repeat(Math.max(2, local.length - 2))}@${domain}`;
output.write(`Candidate: ${maskedEmail} · UUID suffix ${user.id.slice(-8)}\n`);
output.write("No account has been changed yet.\n");
const confirmation = await prompt.question('Type "BOOTSTRAP OWNER" to continue: ');
prompt.close();
if (confirmation !== "BOOTSTRAP OWNER") {
  output.write("Bootstrap cancelled.\n");
  process.exit(0);
}

const { error } = await admin.rpc("bootstrap_initial_owner", {
  p_user_id: user.id,
});
if (error) throw new Error("Owner bootstrap failed.");
output.write(`Owner bootstrap completed for UUID suffix ${user.id.slice(-8)}.\n`);
