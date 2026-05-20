#!/usr/bin/env node
/**
 * Creates Supabase Auth users for staff portals + demo students; links students.auth_user_id.
 *
 * Requires the PROJECT service_role JWT (Dashboard → Settings → API → service_role, starts with eyJ...).
 * A Supabase CLI personal token (sbp_...) will NOT work with Auth Admin — use service_role.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=eyJ... npm run seed:portal-credentials
 *
 * Optional:
 *   SEED_PASSWORD=123456   (default 123456)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const fileEnv = loadEnvFile(resolve(root, ".env"));
const env = { ...fileEnv, ...process.env };

const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
let serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.SUPABASE_SERVICE_KEY;

const PASSWORD = (env.SEED_PASSWORD ?? "123456").trim();

if (!url || !serviceKey) {
  console.error(
    "Missing SUPABASE_URL (or VITE_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY in .env or environment.",
  );
  console.error(
    "\nGet service_role from: Supabase Dashboard → Project Settings → API → Project API keys → service_role (secret JWT, starts with eyJ).",
  );
  console.error("Do not use sbp_ personal access tokens here — they cannot call Auth Admin.\n");
  process.exit(1);
}

if (serviceKey.startsWith("sbp_")) {
  console.error(
    "This looks like a personal access token (sbp_...). Auth Admin needs the service_role JWT from Project Settings → API.",
  );
  process.exit(1);
}

const PORTALS = [
  { label: "Head of COE", portal: "head_of_coe", email: "coe@gcu-portal.local" },
  { label: "Admin 1", portal: "admin_1", email: "admin1@gcu-portal.local" },
  { label: "Admin 2", portal: "admin_2", email: "admin2@gcu-portal.local" },
  { label: "Hostel", portal: "hostel", email: "hostel@gcu-portal.local" },
  { label: "Academic fees", portal: "fees", email: "fees@gcu-portal.local" },
  { label: "Library", portal: "library", email: "library@gcu-portal.local" },
];

const STUDENT_ROLLS = ["24btre152", "24btre148"];

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function findUserIdByEmail(email) {
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === email.toLowerCase());
    if (u) return u.id;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function ensurePortalProfile(userId, portal, email) {
  const { error } = await admin.from("portal_profiles").upsert(
    { user_id: userId, portal, email: email.toLowerCase() },
    { onConflict: "user_id" },
  );
  if (error) throw error;
}

async function upsertStaffUser(row) {
  const { email: rawEmail, portal, label } = row;
  const email = rawEmail.toLowerCase();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { portal },
  });

  if (error) {
    const msg = error.message ?? "";
    if (/already|registered|exists/i.test(msg)) {
      const id = await findUserIdByEmail(email);
      if (!id) throw new Error(`Could not resolve user id for ${email}`);
      const { error: updErr } = await admin.auth.admin.updateUserById(id, {
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { portal },
      });
      if (updErr) throw updErr;
      await ensurePortalProfile(id, portal, email);
      return { label, email, portal, ok: true, note: "updated" };
    }
    throw error;
  }
  if (data.user) {
    await ensurePortalProfile(data.user.id, portal, email);
    return { label, email, portal, ok: true, note: "created" };
  }
  throw new Error(`No user returned for ${row.label}`);
}

async function upsertStudentAuth() {
  const { data: rows, error } = await admin
    .from("students")
    .select("id, email, student_id")
    .in("student_id", STUDENT_ROLLS);

  if (error) throw error;
  const results = [];

  if (!rows?.length) {
    console.warn("No rows in students for 24btre152 / 24btre148 — skip student Auth users.");
    return results;
  }

  for (const s of rows) {
    const email = String(s.email).toLowerCase();
    try {
      const { data, error: ce } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
      });

      let userId = data?.user?.id;

      if (ce) {
        const msg = ce.message ?? "";
        if (/already|registered|exists/i.test(msg)) {
          userId = await findUserIdByEmail(email);
          if (userId) {
            await admin.auth.admin.updateUserById(userId, {
              password: PASSWORD,
              email_confirm: true,
            });
          }
        } else {
          throw ce;
        }
      }

      if (!userId) throw new Error(`No auth user for ${email}`);

      const { error: ue } = await admin.from("students").update({ auth_user_id: userId }).eq("id", s.id);
      if (ue) throw ue;

      results.push({
        label: `Student ${s.student_id}`,
        email,
        password: PASSWORD,
        ok: true,
        note: "linked auth_user_id",
      });
    } catch (e) {
      results.push({
        label: `Student ${s.student_id}`,
        email,
        password: PASSWORD,
        ok: false,
        note: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return results;
}

async function main() {
  const staffResults = [];
  for (const row of PORTALS) {
    try {
      staffResults.push(await upsertStaffUser(row));
    } catch (e) {
      staffResults.push({
        label: row.label,
        email: row.email,
        ok: false,
        note: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const studentResults = await upsertStudentAuth();

  const lines = [];
  lines.push("GCU portal — seeded logins (same password for every account below)");
  lines.push("");
  lines.push(`Password: ${PASSWORD}`);
  lines.push("");
  lines.push("--- Staff ---");
  for (const r of staffResults) {
    lines.push(
      `${r.ok ? "OK" : "FAIL"}  email=${r.email}  password=${PASSWORD}  (${r.label})  ${r.note ?? ""}`,
    );
  }
  lines.push("");
  lines.push("--- Students (emails from public.students) ---");
  for (const r of studentResults) {
    lines.push(
      `${r.ok ? "OK" : "FAIL"}  email=${r.email}  password=${PASSWORD}  (${r.label})  ${r.note ?? ""}`,
    );
  }

  const text = lines.join("\n");
  console.log("\n" + text + "\n");

  const outPath = resolve(root, "scripts", "LAST_SEEDED_LOGINS.txt");
  writeFileSync(outPath, text + `\n\nGenerated at ${new Date().toISOString()}\n`, "utf8");
  console.log(`Saved copy: ${outPath}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
