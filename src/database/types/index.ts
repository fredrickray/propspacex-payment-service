import * as schema from '@/database/schemas';
import type { BuildQueryResult, DBQueryConfig, ExtractTablesWithRelations } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type DrizzleSchemaType = typeof schema;

export type DrizzleDatabaseType = NodePgDatabase<DrizzleSchemaType>;

/**
 * The below lines of code were gotten from github. I had to do this because drizzle does not provide default support for table relations as of 0.45.1.
 * Source: @link https://github.com/drizzle-team/drizzle-orm/issues/695#issuecomment-1973603420
 */
type TablesWithRelations = ExtractTablesWithRelations<DrizzleSchemaType>;

export type IncludeRelation<TableName extends keyof TablesWithRelations> =
  DBQueryConfig<
    "one" | "many",
    boolean,
    TablesWithRelations,
    TablesWithRelations[TableName]
  >["with"];

export type IncludeColumns<TableName extends keyof TablesWithRelations> =
  DBQueryConfig<
    "one" | "many",
    boolean,
    TablesWithRelations,
    TablesWithRelations[TableName]
  >["columns"];

export type InferQueryModel<
  TableName extends keyof TablesWithRelations,
  Columns extends IncludeColumns<TableName> | undefined = undefined,
  With extends IncludeRelation<TableName> | undefined = undefined,
> = BuildQueryResult<
  TablesWithRelations,
  TablesWithRelations[TableName],
  {
    columns: Columns;
    with: With;
  }
>;