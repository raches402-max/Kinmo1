ALTER TABLE "users" ALTER COLUMN "email" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "oidc_sub" varchar;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "legacy_oidc_subs" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_oidc_sub_unique" UNIQUE("oidc_sub");