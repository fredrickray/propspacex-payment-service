import { createdAtColumn, updatedAtColumn, userIdColumn } from "@/database/schemas/base.schema";
import { currenciesTable } from "@/database/schemas/currency.schema";
import { InferQueryModel } from "@/database/types";
import { PaymentStatus } from "@/v1/payment/payment.const";
import { relations, sql } from "drizzle-orm";
import { bigint, check, index, integer, jsonb, pgEnum, pgTable, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

export const statusEnum = pgEnum('status', PaymentStatus);

export const paymentsTable = pgTable('payments', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  buyerId: userIdColumn,
  propertyId: uuid().notNull(),
  idempotencyKey: varchar({ length: 255 }).notNull(),
  currencyCode: varchar({ length: 3 }).references(() => currenciesTable.code),
  amount: integer().notNull(),
  provider: varchar({ length: 255 }).notNull(),
  providerReference: varchar({ length: 255 }).unique().notNull(),
  paymentLink: varchar({ length: 255 }).notNull(),
  status: statusEnum().default(PaymentStatus.PENDING).notNull(),
  rawProviderPayload: jsonb(),
  createdAt: createdAtColumn,
  updatedAt: updatedAtColumn,
  completedAt: timestamp({ mode: 'string', withTimezone: true }),
  failedAt: timestamp({ mode: 'string', withTimezone: true }),
  cancelledAt: timestamp({ mode: 'string', withTimezone: true }),
}, (t) => ([
  check('amount', sql`${t.amount} > 0`),
  index('idx_payments_buyer_id_and_property_id').on(t.buyerId, t.propertyId),
  index('idx_payments_property_id').on(t.propertyId),
  index('idx_payments_provider_reference').on(t.providerReference),
  // THIS WORKS AS AN INDEX AS WELL, BUT WE NEED TO USE THE UNIQUE CONSTRAINT
  unique('unique_payments_idempotency_data').on(t.buyerId, t.propertyId, t.idempotencyKey, t.provider),
]))

export const paymentRelations = relations(paymentsTable, ({ one }) => ({
  currency: one(currenciesTable, {
    fields: [paymentsTable.currencyCode],
    references: [currenciesTable.code],
  }),
}))

export type PaymentDtoType = InferQueryModel<'paymentsTable', undefined, {
  currency: true
}>