import {
  DrizzleConfig
} from 'drizzle-orm';
import { ClientConfig, PoolConfig } from 'pg';

export type DrizzleConfigInterface<TSchema extends Record<string, unknown> = Record<string, never>> = {
  pg: {
    connection: 'client' | 'pool';
    config: ClientConfig | PoolConfig;
  };
  config?: DrizzleConfig<TSchema> | undefined;
}