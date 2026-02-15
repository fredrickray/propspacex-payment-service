import { currenciesTable } from "@/database/schemas";
import { DrizzleDatabaseType } from "@/database/types";
import { Logger } from "@nestjs/common";
import { eq } from "drizzle-orm";

export async function seedDefaultData(db: DrizzleDatabaseType) {
  // just to seed naira for now. in the future we can seed other currencies when the app starts and they don't exist
  const existingNigerianCurrency = await db.select().from(currenciesTable).where(eq(currenciesTable.code, 'NGN')).limit(1);
  
  if (existingNigerianCurrency.length === 0) {
    const nigerianCurrency = await db.insert(currenciesTable).values({ code: 'NGN', name: 'Nigerian Naira', symbol: '₦', exponent: 100, enabled: true }).returning().execute();
    Logger.log('Seeded Nigerian currency', nigerianCurrency);
  }
}