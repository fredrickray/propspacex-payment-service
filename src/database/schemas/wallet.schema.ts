import { createdAtColumn, updatedAtColumn, userIdColumn } from "@/database/schemas/base.schema"
import { currenciesTable } from "@/database/schemas/currency.schema"
import { InferQueryModel } from "@/database/types"
import { relations, sql } from "drizzle-orm"
import { bigint, check, pgTable, varchar } from "drizzle-orm/pg-core"

export const walletsTable = pgTable('wallets', {
  id: bigint({ mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  userId: userIdColumn.unique(),
  currencyCode: varchar('currency_code').references(() => currenciesTable.code),
  status: varchar('status', { length: 20 }).default('active').notNull(),
  totalBalance: bigint('total_balance', { mode: 'number' }).default(sql`0`).notNull(),
  availableBalance: bigint('available_balance', { mode: 'number' }).default(sql`0`).notNull(),
  createdAt: createdAtColumn,
  updatedAt: updatedAtColumn,
}, (t) => [
  check('status', sql`${t.status} IN ('active', 'frozen', 'closed')`),
  check('totalBalance', sql`${t.totalBalance} >= 0`),
  check('availableBalance', sql`${t.availableBalance} >= 0`),
])

export const walletRelations = relations(walletsTable, ({ one }) => ({
  currency: one(currenciesTable, {
    fields: [walletsTable.currencyCode],
    references: [currenciesTable.code],
  })
}))

export type WalletDtoType = InferQueryModel<'walletsTable', undefined, {
  currency: true
}>