import { RpcExistsError, RpcNotFoundError, RpcPreconditionFailedError } from "@/common/exceptions/rpc-errors";
import { CurrencyMapper } from "@/common/mappers";
import { currenciesTable, walletsTable } from "@/database/schemas";
import { type DrizzleDatabaseType } from "@/database/types";
import { DRIZZLE_SERVICE_TAG } from "@/drizzle/drizzle.definition";
import { CreateWalletReq, CreateWalletRes, WalletResponseType } from "@/v1/wallet/wallet";
import { WalletStatusConst } from "@/v1/wallet/wallet.const";
import { WalletMapper } from "@/v1/wallet/wallet.mapper";
import { IncreaseOrDecreaseWalletBalanceReq } from "@/v1/wallet/wallet.type";
import { Inject, Injectable } from "@nestjs/common";
import { eq, sql } from "drizzle-orm";

@Injectable()
export class WalletService {
  constructor(@Inject(DRIZZLE_SERVICE_TAG) private drizzleClient: DrizzleDatabaseType) { }

  async createWallet(data: CreateWalletReq): Promise<CreateWalletRes> {
    const currencyPromise = this.drizzleClient.query.currenciesTable.findFirst({
      where: eq(currenciesTable.code, data.currency.toUpperCase()),
    })

    const [newWallet] = await this.drizzleClient.insert(walletsTable).values({
      userId: data.userId,
      currencyCode: data.currency.toUpperCase(),
      status: WalletStatusConst.ACTIVE,
    }).onConflictDoNothing().returning();

    if (!newWallet) {
      throw new RpcExistsError('Wallet already exists');
    }

    const currency = await currencyPromise;

    return { id: newWallet.id, userId: newWallet.userId, currency: currency ? CurrencyMapper.toResponse(currency) : undefined };
  }

  async getWalletByUserId(data: { userId: string }): Promise<WalletResponseType> {
    const wallet = await this.drizzleClient.query.walletsTable.findFirst({
      where: eq(walletsTable.userId, data.userId),
      with: {
        currency: true,
      }
    })

    if (!wallet) {
      throw new RpcNotFoundError('Wallet not found!');
    }

    return WalletMapper.toResponse(wallet);
  }

  async getWalletById(data: { walletId: number }): Promise<WalletResponseType> {
    const wallet = await this.drizzleClient.query.walletsTable.findFirst({
      where: eq(walletsTable.id, data.walletId),
      with: {
        currency: true,
      }
    })

    if (!wallet) {
      throw new RpcNotFoundError('Wallet not found!');
    }

    return WalletMapper.toResponse(wallet);
  }

  async increaseOrDecreaseWalletBalance(data: Omit<IncreaseOrDecreaseWalletBalanceReq, 'totalBalance'>): Promise<WalletResponseType>
  async increaseOrDecreaseWalletBalance(data: Omit<IncreaseOrDecreaseWalletBalanceReq, 'availableBalance'>): Promise<WalletResponseType>
  async increaseOrDecreaseWalletBalance(data: IncreaseOrDecreaseWalletBalanceReq): Promise<WalletResponseType>
  async increaseOrDecreaseWalletBalance(data: IncreaseOrDecreaseWalletBalanceReq): Promise<WalletResponseType> {
    const wallet = await this.drizzleClient.query.walletsTable.findFirst({
      where: eq(walletsTable.userId, data.userId),
      with: {
        currency: true,
      }
    })

    if (!wallet) {
      throw new RpcNotFoundError('Wallet not found!');
    }

    if (data.type === 'increase') {
      if (!data.totalBalance && !data.availableBalance) {
        throw new RpcPreconditionFailedError('Total balance or available balance is required!');
      }

      const [updatedWallet] = await this.drizzleClient.update(walletsTable).set({
        ...(typeof data.totalBalance === 'number' && { totalBalance: sql`${walletsTable.totalBalance} + ${Math.abs(data.totalBalance)}`, }),
        ...(typeof data.availableBalance === 'number' && { availableBalance: sql`${walletsTable.availableBalance} + ${Math.abs(data.availableBalance)}`, })
      }).where(eq(walletsTable.id, wallet.id)).returning();

      return WalletMapper.toResponse({ ...updatedWallet, currency: wallet.currency });
    }

    if (data.totalBalance && data.availableBalance) {
      const newTotalBalance = wallet.totalBalance - Math.abs(data.totalBalance);
      const newAvailableBalance = wallet.availableBalance - Math.abs(data.availableBalance);

      if (newTotalBalance < 0 || newAvailableBalance < 0) {
        throw new RpcPreconditionFailedError('Cannot decrease wallet balance due to insufficient balance!');
      }

      const [updatedWallet] = await this.drizzleClient.update(walletsTable).set({
        totalBalance: newTotalBalance,
        availableBalance: newAvailableBalance
      }).where(eq(walletsTable.userId, data.userId)).returning()

      return WalletMapper.toResponse({ ...updatedWallet, currency: wallet.currency });
    }

    if (data.totalBalance) {
      const newTotalBalance = wallet.totalBalance - Math.abs(data.totalBalance);

      if (newTotalBalance < 0) {
        throw new RpcPreconditionFailedError('Cannot decrease wallet total balance due to insufficient balance!');
      }

      const [updatedWallet] = await this.drizzleClient.update(walletsTable).set({
        totalBalance: newTotalBalance
      }).where(eq(walletsTable.userId, data.userId)).returning()

      return WalletMapper.toResponse({ ...updatedWallet, currency: wallet.currency });
    }

    if (!data.availableBalance) {
      throw new RpcPreconditionFailedError('Available balance is required!');
    }

    const newAvailableBalance = wallet.availableBalance - Math.abs(data.availableBalance);

    if (newAvailableBalance < 0) {
      throw new RpcPreconditionFailedError('Cannot decrease wallet available balance due to insufficient balance!');
    }

    const [updatedWallet] = await this.drizzleClient.update(walletsTable).set({
      availableBalance: newAvailableBalance
    }).where(eq(walletsTable.userId, data.userId)).returning()

    return WalletMapper.toResponse({ ...updatedWallet, currency: wallet.currency });
  }
}