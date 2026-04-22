CREATE TYPE "public"."status" AS ENUM('pending', 'success', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"currency_code" varchar(3),
	"amount" integer NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_reference" varchar(255) NOT NULL,
	"payment_link" varchar(255) NOT NULL,
	"status" "status" DEFAULT 'pending' NOT NULL,
	"raw_provider_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "payments_providerReference_unique" UNIQUE("provider_reference"),
	CONSTRAINT "unique_payments_idempotency_data" UNIQUE("user_id","property_id","idempotency_key","provider"),
	CONSTRAINT "amount" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transactions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"wallet_id" bigint NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"direction" varchar(10) NOT NULL,
	"entry_type" varchar(30) NOT NULL,
	"reference_type" varchar(30),
	"reference_id" varchar(255),
	"counterparty_wallet_id" bigint,
	"status" varchar(20) DEFAULT 'completed' NOT NULL,
	"note" varchar(500),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "amountMinor" CHECK ("transactions"."amount_minor" > 0),
	CONSTRAINT "direction" CHECK ("transactions"."direction" IN ('credit', 'debit', 'hold', 'release', 'fee')),
	CONSTRAINT "status" CHECK ("transactions"."status" IN ('pending', 'completed', 'failed', 'reversed'))
);
--> statement-breakpoint
ALTER TABLE "wallets" ADD COLUMN "held_balance" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_counterparty_wallet_id_wallets_id_fk" FOREIGN KEY ("counterparty_wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_payments_buyer_id_and_property_id" ON "payments" USING btree ("user_id","property_id");--> statement-breakpoint
CREATE INDEX "idx_payments_property_id" ON "payments" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "idx_payments_provider_reference" ON "payments" USING btree ("provider_reference");--> statement-breakpoint
CREATE INDEX "idx_transactions_wallet_id" ON "transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_user_id" ON "transactions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_transactions_reference" ON "transactions" USING btree ("reference_type","reference_id");--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "heldBalance" CHECK ("wallets"."held_balance" >= 0);