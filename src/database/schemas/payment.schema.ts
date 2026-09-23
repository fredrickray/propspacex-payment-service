import { createdAtColumn, updatedAtColumn, userIdColumn } from "@/database/schemas/base.schema";
import { currenciesTable } from "@/database/schemas/currency.schema";
import { escrowsTable } from "@/database/schemas/escrow.schema";
import { InferQueryModel } from "@/database/types";
import { PaymentPurpose, PaymentStatus } from "@/v1/payment/payment.const";
import { relations, sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgEnum, pgTable, timestamp, unique, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const statusEnum = pgEnum('status', PaymentStatus);
export const paymentPurposeEnum = pgEnum('payment_purpose', PaymentPurpose);

export const paymentsTable = pgTable('payments', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  buyerId: userIdColumn,
  escrowId: uuid('escrow_id').references(() => escrowsTable.id),
  propertyId: uuid('property_id'),
  idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
  currencyCode: varchar('currency_code', { length: 3 }).references(() => currenciesTable.code),
  amount: integer().notNull(),
  provider: varchar({ length: 255 }).notNull(),
  purpose: paymentPurposeEnum('purpose').default(PaymentPurpose.ESCROW_FUNDING).notNull(),
  providerReference: varchar('provider_reference', { length: 255 }).unique().notNull(),
  paymentLink: varchar('payment_link', { length: 255 }).notNull(),
  status: statusEnum().default(PaymentStatus.PENDING).notNull(),
  rawProviderPayload: jsonb('raw_provider_payload'),
  createdAt: createdAtColumn,
  updatedAt: updatedAtColumn,
  completedAt: timestamp('completed_at', { mode: 'string', withTimezone: true }),
  failedAt: timestamp('failed_at', { mode: 'string', withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { mode: 'string', withTimezone: true }),
}, (t) => ([
  check('amount', sql`${t.amount} > 0`),
  index('idx_payments_buyer_id_and_property_id').on(t.buyerId, t.propertyId),
  index('idx_payments_property_id').on(t.propertyId),
  index('idx_payments_provider_reference').on(t.providerReference),
  index('idx_payments_escrow_id').on(t.escrowId),
  index('idx_payments_purpose').on(t.purpose),
  // THIS WORKS AS AN INDEX AS WELL, BUT WE NEED TO USE THE UNIQUE CONSTRAINT
  unique('unique_payments_idempotency_data').on(t.buyerId, t.propertyId, t.idempotencyKey, t.provider),
  uniqueIndex('payments_escrow_idempotency_unique')
    .on(t.buyerId, t.escrowId, t.idempotencyKey, t.provider)
    .where(sql`${t.escrowId} IS NOT NULL`),
]))

export const paymentRelations = relations(paymentsTable, ({ one }) => ({
  currency: one(currenciesTable, {
    fields: [paymentsTable.currencyCode],
    references: [currenciesTable.code],
  }),
  escrow: one(escrowsTable, {
    fields: [paymentsTable.escrowId],
    references: [escrowsTable.id],
  }),
}))

export type PaymentDtoType = InferQueryModel<'paymentsTable', undefined, {
  currency: true
}>