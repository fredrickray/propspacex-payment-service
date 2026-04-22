import { createdAtColumn } from "@/database/schemas/base.schema"
import { walletsTable } from "@/database/schemas/wallet.schema"
import { InferQueryModel } from "@/database/types"
import { relations, sql } from "drizzle-orm"
import { bigint, check, index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core"

export const transactionsTable = pgTable('transactions', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  walletId: bigint('wallet_id', { mode: 'number' }).references(() => walletsTable.id).notNull(),
  userId: uuid('user_id').notNull(),
  amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
  direction: varchar('direction', { length: 10 }).notNull(), // 'credit' | 'debit' | 'hold' | 'release' | 'fee'
  entryType: varchar('entry_type', { length: 30 }).notNull(), // 'deposit' | 'withdrawal' | 'escrow_fund' | 'escrow_release' | 'refund' | 'transfer' | 'payment'
  referenceType: varchar('reference_type', { length: 30 }), // 'escrow' | 'payment' | 'withdrawal' | 'manual_adjustment'
  referenceId: varchar('reference_id', { length: 255 }),
  counterpartyWalletId: bigint('counterparty_wallet_id', { mode: 'number' }).references(() => walletsTable.id),
  status: varchar('status', { length: 20 }).default('completed').notNull(),
  note: varchar('note', { length: 500 }),
  metadata: jsonb(),
  createdAt: createdAtColumn,
  processedAt: timestamp('processed_at', { mode: 'string', withTimezone: true }),
}, (t) => ([
  check('amountMinor', sql`${t.amountMinor} > 0`),
  check('direction', sql`${t.direction} IN ('credit', 'debit', 'hold', 'release', 'fee')`),
  check('status', sql`${t.status} IN ('pending', 'completed', 'failed', 'reversed')`),
  index('idx_transactions_wallet_id').on(t.walletId),
  index('idx_transactions_user_id').on(t.userId),
  index('idx_transactions_reference').on(t.referenceType, t.referenceId),
]))

export const transactionRelations = relations(transactionsTable, ({ one }) => ({
  wallet: one(walletsTable, {
    fields: [transactionsTable.walletId],
    references: [walletsTable.id],
  }),
  counterpartyWallet: one(walletsTable, {
    fields: [transactionsTable.counterpartyWalletId],
    references: [walletsTable.id],
  }),
}))

export type TransactionDtoType = InferQueryModel<'transactionsTable'>
