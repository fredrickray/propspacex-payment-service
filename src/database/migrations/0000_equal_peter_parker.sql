CREATE TABLE "currencies" (
	"code" varchar(3) PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"exponent" smallint NOT NULL,
	"enabled" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "wallets_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid NOT NULL,
	"currency_code" varchar,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"total_balance" bigint DEFAULT 0 NOT NULL,
	"available_balance" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "status" CHECK ("wallets"."status" IN ('active', 'frozen', 'closed')),
	CONSTRAINT "totalBalance" CHECK ("wallets"."total_balance" >= 0),
	CONSTRAINT "availableBalance" CHECK ("wallets"."available_balance" >= 0)
);
--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_currency_code_currencies_code_fk" FOREIGN KEY ("currency_code") REFERENCES "public"."currencies"("code") ON DELETE no action ON UPDATE no action;