CREATE SCHEMA "user_auth";
--> statement-breakpoint
CREATE TABLE "user_auth"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_auth"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user_auth"."users" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_auth"."verifications" (
	"id" uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"mobile" text
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_auth"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_auth"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "user_auth"."users"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "accounts_userId_idx" ON "user_auth"."accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_userId_idx" ON "user_auth"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "user_auth"."verifications" USING btree ("identifier");--> statement-breakpoint
CREATE POLICY "users_all_own" ON "users" AS PERMISSIVE FOR ALL TO public USING ("users"."id" = current_setting('app.user_id', true)::uuid) WITH CHECK ("users"."id" = current_setting('app.user_id', true)::uuid);