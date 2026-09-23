CREATE TYPE "public"."payment_purpose" AS ENUM('escrow_funding', 'wallet_topup');--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "property_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "purpose" "payment_purpose" DEFAULT 'escrow_funding' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_payments_purpose" ON "payments" USING btree ("purpose");
