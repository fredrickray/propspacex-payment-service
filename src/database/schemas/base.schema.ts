import { timestamp, uuid } from "drizzle-orm/pg-core";

export const userIdColumn = uuid('user_id').notNull();

export const createdAtColumn = timestamp('created_at', { mode: 'string', withTimezone: true }).defaultNow().notNull();

export const updatedAtColumn = timestamp('updated_at', { mode: 'string', withTimezone: true }).$onUpdate(() => new Date().toUTCString())