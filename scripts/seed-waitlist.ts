/**
 * Seed the invite-only allowlist + initial invite codes.
 *
 * Run after `npm run db:push` has applied the new tables.
 *
 *   DATABASE_URL=<dev or prod url>  npx tsx scripts/seed-waitlist.ts
 *
 * Idempotent: uses ON CONFLICT DO NOTHING for emails, and only inserts codes
 * that don't already exist.
 */

import { Pool } from "pg";

const FOUNDER_EMAILS = [
  "raches402@gmail.com",
  "wmc5017@gmail.com",
  "jacqui.van@gmail.com",
  "sfdreamlife@gmail.com",
  "etran42@gmail.com",
  "nnadams87@gmail.com",
  "stephjzhou@gmail.com",
  "rachel@kinmo.ai",
];

const INVITE_CODES: Array<{ code: string; label: string; maxUses: number }> = [
  { code: "frands", label: "Frands", maxUses: 25 },
  { code: "gold24", label: "Gold list 2024", maxUses: 25 },
  { code: "haas", label: "Haas family", maxUses: 25 },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: url });

  try {
    console.log(`\nTarget: ${url.replace(/:[^:@]+@/, ":****@")}`);
    console.log("");

    // Seed founder emails
    console.log("Seeding allowed_emails (founders)…");
    for (const raw of FOUNDER_EMAILS) {
      const email = raw.trim().toLowerCase();
      const result = await pool.query(
        `INSERT INTO allowed_emails (email, source, claimed_at)
         VALUES ($1, 'founder', NOW())
         ON CONFLICT (email) DO NOTHING
         RETURNING email`,
        [email],
      );
      if (result.rowCount && result.rowCount > 0) {
        console.log(`  + ${email}`);
      } else {
        console.log(`  · ${email} (already present)`);
      }
    }

    // Seed invite codes
    console.log("\nSeeding invite_codes…");
    for (const c of INVITE_CODES) {
      const result = await pool.query(
        `INSERT INTO invite_codes (code, label, max_uses)
         VALUES ($1, $2, $3)
         ON CONFLICT (code) DO NOTHING
         RETURNING code`,
        [c.code, c.label, c.maxUses],
      );
      if (result.rowCount && result.rowCount > 0) {
        console.log(`  + ${c.code.padEnd(10)}  "${c.label}"  max=${c.maxUses}`);
      } else {
        console.log(`  · ${c.code.padEnd(10)}  (already present)`);
      }
    }

    // Summary
    const { rows: allowed } = await pool.query(`SELECT COUNT(*) FROM allowed_emails`);
    const { rows: codes } = await pool.query(
      `SELECT code, label, uses_count, max_uses, is_active FROM invite_codes ORDER BY code`,
    );
    console.log("\n─── Summary ───────────────");
    console.log(`allowed_emails: ${allowed[0].count}`);
    console.log("invite_codes:");
    for (const r of codes) {
      console.log(
        `  ${r.code.padEnd(10)}  "${r.label}"  ${r.uses_count}/${r.max_uses}  ${r.is_active ? "active" : "INACTIVE"}`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
