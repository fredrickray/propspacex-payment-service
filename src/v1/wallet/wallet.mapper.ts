import { CurrencyMapper } from "@/common/mappers";
import { type TransactionDtoType, type WalletDtoType } from "@/database/schemas";
import { CurrencyCodeToProto, WalletStatusToProto } from "@/v1/wallet/wallet.const";
import type { Timestamp, Wallet, WalletTransaction } from "@/v1/wallet/wallet";

export class WalletMapper {
  /**
   * Converts a DB wallet record to the proto Wallet message shape.
   * - bigint id → string wallet_id
   * - string status → WalletStatus enum number
   * - timestamps → google.protobuf.Timestamp
   */
  static toProto(wallet: WalletDtoType): Wallet {
    return {
      walletId: wallet.id.toString(),
      userId: wallet.userId,
      status: WalletStatusToProto[wallet.status] ?? 0,
      currency: wallet.currency
        ? {
          ...CurrencyMapper.toResponse(wallet.currency),
          code: CurrencyCodeToProto[wallet.currency.code] ?? 0,
        }
        : undefined,
      totalBalanceMinor: wallet.totalBalance,
      availableBalanceMinor: wallet.availableBalance,
      heldBalanceMinor: wallet.heldBalance,
      createdAt: WalletMapper.toTimestamp(wallet.createdAt),
      updatedAt: wallet.updatedAt ? WalletMapper.toTimestamp(wallet.updatedAt) : undefined,
    };
  }

  /**
   * Converts a DB transaction record to the proto WalletTransaction message shape.
   */
  static transactionToProto(tx: TransactionDtoType): WalletTransaction {
    return {
      transactionId: tx.id.toString(),
      walletId: tx.walletId.toString(),
      userId: tx.userId,
      amountMinor: tx.amountMinor,
      direction: tx.direction,
      entryType: tx.entryType,
      referenceType: tx.referenceType ?? '',
      referenceId: tx.referenceId ?? '',
      note: tx.note ?? '',
      createdAt: WalletMapper.toTimestamp(tx.createdAt),
    };
  }

  /**
   * Converts an ISO date string to a google.protobuf.Timestamp.
   */
  static toTimestamp(dateStr: string): Timestamp {
    const ms = new Date(dateStr).getTime();
    return {
      seconds: Math.floor(ms / 1000),
      nanos: (ms % 1000) * 1_000_000,
    };
  }
}