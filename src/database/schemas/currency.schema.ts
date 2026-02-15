import { boolean, pgTable, smallint, varchar } from "drizzle-orm/pg-core";

export const currenciesTable = pgTable('currencies', {
  code: varchar({ length: 3, }).primaryKey(),
  name: varchar({ length: 50 }).notNull(),
  symbol: varchar({ length: 20 }).notNull(),
  exponent: smallint().notNull(),
  enabled: boolean().default(true)
})

export type CurrencyType = typeof currenciesTable.$inferSelect;