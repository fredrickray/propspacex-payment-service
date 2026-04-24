import { createdAtColumn } from '@/database/schemas/base.schema';
import { pgTable, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Stores idempotency keys for mutating gRPC RPCs (scope + key → stable resource id).
 */
export const grpcIdempotencyTable = pgTable(
  'grpc_idempotency_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scope: varchar('scope', { length: 96 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    resourceId: varchar('resource_id', { length: 255 }).notNull(),
    createdAt: createdAtColumn,
  },
  (t) => [uniqueIndex('grpc_idempotency_scope_key_idx').on(t.scope, t.idempotencyKey)],
);
