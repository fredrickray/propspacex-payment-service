import * as schema from '@/database/schemas';
import { Injectable } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client, Pool } from 'pg';
import { DrizzleConfigInterface } from './drizzle.interface';

@Injectable()
export class DrizzleService {
  public async getDrizzle(options: DrizzleConfigInterface<typeof schema>) {
    if (options.pg.connection === 'client') {
      const client = new Client(options.pg.config);
      await client.connect();
      return drizzle(client, options?.config || {});
    }
    const pool = new Pool(options.pg.config);
    return drizzle(pool, options?.config || {});
  }
}