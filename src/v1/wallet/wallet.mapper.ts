import { CurrencyMapper } from "@/common/mappers";
import { type WalletDtoType } from "@/database/schemas";
import { WalletResponseType } from "@/v1/wallet/wallet";

export class WalletMapper {
  static toResponse(wallet: WalletDtoType): WalletResponseType {
    return {
      id: wallet.id,
      userId: wallet.userId,
      totalBalance: wallet.totalBalance,
      availableBalance: wallet.availableBalance,
      status: wallet.status,
      createdAt: wallet.createdAt.toISOString(),
      updatedAt: wallet.updatedAt?.toISOString() ?? undefined,
      currency: wallet.currency ? CurrencyMapper.toResponse(wallet.currency) : undefined,
    }
  }
}