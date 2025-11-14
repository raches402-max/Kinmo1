import { pool } from "./db";

/**
 * Manual migration script to add oidc_sub and legacy_oidc_subs columns to users table
 */

async function migrateUsersSchema(): Promise<void> {
  const client = await pool.connect();

  try {
    console.log("Starting users table migration...\n");

    // Step 1: Make email NOT NULL (should already have values)
    console.log("Step 1: Making email NOT NULL...");
    await client.query(`ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;`);
    console.log("✅ Email column set to NOT NULL\n");

    // Step 2: Add oidc_sub column
    console.log("Step 2: Adding oidc_sub column...");
    await client.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "oidc_sub" varchar;`);
    console.log("✅ oidc_sub column added\n");

    // Step 3: Add legacy_oidc_subs column
    console.log("Step 3: Adding legacy_oidc_subs column...");
    await client.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "legacy_oidc_subs" jsonb;`);
    console.log("✅ legacy_oidc_subs column added\n");

    // Step 4: Migrate existing user IDs to oidc_sub (they currently use OAuth sub as ID)
    console.log("Step 4: Migrating existing user.id values to oidc_sub...");
    await client.query(`
      UPDATE "users"
      SET "oidc_sub" = "id"
      WHERE "oidc_sub" IS NULL;
    `);
    const result = await client.query(`SELECT COUNT(*) FROM "users" WHERE "oidc_sub" IS NOT NULL;`);
    console.log(`✅ Migrated ${result.rows[0].count} users\n`);

    // Step 5: Add unique constraint on oidc_sub
    console.log("Step 5: Adding unique constraint on oidc_sub...");
    await client.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "users_oidc_sub_unique" UNIQUE("oidc_sub");
    `);
    console.log("✅ Unique constraint added\n");

    console.log("=".repeat(60));
    console.log("✅ Migration completed successfully!");
    console.log("=".repeat(60));

  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
migrateUsersSchema()
  .then(() => {
    console.log("\n✅ All done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Migration failed:", error);
    process.exit(1);
  });
