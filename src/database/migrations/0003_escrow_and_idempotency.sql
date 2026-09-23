CREATE TABLE "escrows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_ref" varchar(255) NOT NULL,
	"buyer_user_id" uuid NOT NULL,
	"agent_user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"currency_code" varchar(3) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"platform_fee_minor" bigint DEFAULT 0 NOT NULL,
	"net_to_agent_minor" bigint NOT NULL,
	"status" varchar(40) NOT NULL,
	"funded_at" timestamp with time zone,
	"service_marked_complete_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "escrows_deal_ref_unique" UNIQUE("deal_ref"),
	CONSTRAINT "escrows_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action,
	CONSTRAINT "amountMinorPositive" CHECK ("escrows"."amount_minor" > 0),
	CONSTRAINT "feesNonNegative" CHECK ("escrows"."platform_fee_minor" >= 0),
	CONSTRAINT "netNonNegative" CHECK ("escrows"."net_to_agent_minor" >= 0)
);--> statement-breakpoint
CREATE TABLE "escrow_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escrow_id" uuid NOT NULL,
	"event_type" varchar(40) NOT NULL,
	"actor_role" varchar(32),
	"actor_user_id" uuid,
	"note" text,
	"metadata_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "escrow_events_escrow_id_escrows_id_fk" FOREIGN KEY ("escrow_id") REFERENCES "public"."escrows"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint
CREATE TABLE "escrow_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escrow_id" uuid NOT NULL,
	"opened_by_user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" varchar(40) NOT NULL,
	"buyer_award_minor" bigint DEFAULT 0 NOT NULL,
	"agent_award_minor" bigint DEFAULT 0 NOT NULL,
	"admin_note" text,
	"escrow_status_before" varchar(40),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	CONSTRAINT "escrow_disputes_escrow_id_escrows_id_fk" FOREIGN KEY ("escrow_id") REFERENCES "public"."escrows"("id") ON DELETE no action ON UPDATE no action
);--> statement-breakpoint
CREATE TABLE "grpc_idempotency_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" varchar(96) NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"resource_id" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "grpc_idempotency_scope_key_idx" ON "grpc_idempotency_records" USING btree ("scope","idempotency_key");--> statement-breakpoint
CREATE INDEX "escrows_buyer_user_id_idx" ON "escrows" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "escrows_agent_user_id_idx" ON "escrows" USING btree ("agent_user_id");--> statement-breakpoint
CREATE INDEX "escrow_events_escrow_id_idx" ON "escrow_events" USING btree ("escrow_id");--> statement-breakpoint
CREATE INDEX "escrow_disputes_escrow_id_idx" ON "escrow_disputes" USING btree ("escrow_id");--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "escrow_id" uuid;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_escrow_id_escrows_id_fk" FOREIGN KEY ("escrow_id") REFERENCES "public"."escrows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payments_escrow_id" ON "payments" USING btree ("escrow_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_escrow_idempotency_unique" ON "payments" USING btree ("user_id","escrow_id","idempotency_key","provider") WHERE "escrow_id" IS NOT NULL;
