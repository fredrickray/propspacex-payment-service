import { type CurrencyType } from "@/database/schemas";

export class CurrencyMapper {
  static toResponse(currency: CurrencyType) {
    return {
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
    }
  }
}