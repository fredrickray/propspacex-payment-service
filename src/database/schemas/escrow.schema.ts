import { createdAtColumn, updatedAtColumn } from '@/database/schemas/base.schema';
import { currenciesTable } from '@/database/schemas/currency.schema';
import { InferQueryModel } from '@/database/types';
import { relations, sql } from 'drizzle-orm';
import { bigint, check, index, pgTable, text, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';

export const escrowsTable = pgTable(
  'escrows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dealRef: varchar('deal_ref', { length: 255 }).notNull(),
    buyerUserId: uuid('buyer_user_id').notNull(),
    agentUserId: uuid('agent_user_id').notNull(),
    propertyId: uuid('property_id').notNull(),
    currencyCode: varchar('currency_code', { length: 3 })
      .notNull()
      .references(() => currenciesTable.code),
    amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
    platformFeeMinor: bigint('platform_fee_minor', { mode: 'number' }).notNull().default(0),
    netToAgentMinor: bigint('net_to_agent_minor', { mode: 'number' }).notNull(),
    status: varchar('status', { length: 40 }).notNull(),
    fundedAt: timestamp('funded_at', { mode: 'string', withTimezone: true }),
    serviceMarkedCompleteAt: timestamp('service_marked_complete_at', {
      mode: 'string',
      withTimezone: true,
    }),
    releasedAt: timestamp('released_at', { mode: 'string', withTimezone: true }),
    refundedAt: timestamp('refunded_at', { mode: 'string', withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { mode: 'string', withTimezone: true }),
    metadataJson: text('metadata_json'),
    createdAt: createdAtColumn,
    updatedAt: updatedAtColumn,
  },
  (t) => [
    unique('escrows_deal_ref_unique').on(t.dealRef),
    check('amountMinorPositive', sql`${t.amountMinor} > 0`),
    check('feesNonNegative', sql`${t.platformFeeMinor} >= 0`),
    check('netNonNegative', sql`${t.netToAgentMinor} >= 0`),
    index('escrows_buyer_user_id_idx').on(t.buyerUserId),
    index('escrows_agent_user_id_idx').on(t.agentUserId),
  ],
);

export const escrowEventsTable = pgTable(
  'escrow_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    escrowId: uuid('escrow_id')
      .notNull()
      .references(() => escrowsTable.id),
    eventType: varchar('event_type', { length: 40 }).notNull(),
    actorRole: varchar('actor_role', { length: 32 }),
    actorUserId: uuid('actor_user_id'),
    note: text('note'),
    metadataJson: text('metadata_json'),
    createdAt: createdAtColumn,
  },
  (t) => [index('escrow_events_escrow_id_idx').on(t.escrowId)],
);

export const escrowDisputesTable = pgTable(
  'escrow_disputes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    escrowId: uuid('escrow_id')
      .notNull()
      .references(() => escrowsTable.id),
    openedByUserId: uuid('opened_by_user_id').notNull(),
    reason: text('reason').notNull(),
    details: text('details'),
    status: varchar('status', { length: 40 }).notNull(),
    buyerAwardMinor: bigint('buyer_award_minor', { mode: 'number' }).notNull().default(0),
    agentAwardMinor: bigint('agent_award_minor', { mode: 'number' }).notNull().default(0),
    adminNote: text('admin_note'),
    escrowStatusBefore: varchar('escrow_status_before', { length: 40 }),
    createdAt: createdAtColumn,
    resolvedAt: timestamp('resolved_at', { mode: 'string', withTimezone: true }),
    updatedAt: updatedAtColumn,
  },
  (t) => [index('escrow_disputes_escrow_id_idx').on(t.escrowId)],
);

export const escrowRelations = relations(escrowsTable, ({ many, one }) => ({
  events: many(escrowEventsTable),
  disputes: many(escrowDisputesTable),
  currency: one(currenciesTable, {
    fields: [escrowsTable.currencyCode],
    references: [currenciesTable.code],
  }),
}));

export const escrowEventRelations = relations(escrowEventsTable, ({ one }) => ({
  escrow: one(escrowsTable, {
    fields: [escrowEventsTable.escrowId],
    references: [escrowsTable.id],
  }),
}));

export const escrowDisputeRelations = relations(escrowDisputesTable, ({ one }) => ({
  escrow: one(escrowsTable, {
    fields: [escrowDisputesTable.escrowId],
    references: [escrowsTable.id],
  }),
}));

export type EscrowRow = typeof escrowsTable.$inferSelect;
export type EscrowEventRow = typeof escrowEventsTable.$inferSelect;
export type EscrowDisputeRow = typeof escrowDisputesTable.$inferSelect;

export type EscrowDtoType = InferQueryModel<'escrowsTable', undefined, { currency: true }>;
