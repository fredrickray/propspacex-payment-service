import { RpcNotFoundError, RpcPreconditionFailedError } from "@/common/exceptions/rpc-errors";
import { currenciesTable, transactionsTable, walletsTable } from "@/database/schemas";
import { type DrizzleDatabaseType } from "@/database/types";
import { DRIZZLE_SERVICE_TAG } from "@/drizzle/drizzle.definition";
import { CurrencyCodeFromProto } from "@/v1/wallet/wallet.const";
import { WalletMapper } from "@/v1/wallet/wallet.mapper";
import type {
  CreateWalletRequest,
  CreateWalletResponse,
  CreditWalletRequest,
  DebitWalletRequest,
  GetWalletByIdRequest,
  GetWalletByUserIdRequest,
  GetWalletResponse,
  ListWalletTransactionsRequest,
  ListWalletTransactionsResponse,
  ListWithdrawalsRequest,
  ListWithdrawalsResponse,
  RequestWithdrawalRequest,
  RequestWithdrawalResponse,
  WalletMutationResponse,
} from "@/v1/wallet/wallet";
import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, sql } from "drizzle-orm";

@Injectable()
export class WalletService {
  constructor(@Inject(DRIZZLE_SERVICE_TAG) private drizzleClient: DrizzleDatabaseType) { }

  // ===========================
  // CreateWallet
  // ===========================
  async createWallet(data: CreateWalletRequest): Promise<CreateWalletResponse> {
    const currencyCode = CurrencyCodeFromProto[data.currencyCode];
    if (!currencyCode) {
      throw new RpcPreconditionFailedError('Invalid or unspecified currency code');
    }

    const currency = await this.drizzleClient.query.currenciesTable.findFirst({
      where: eq(currenciesTable.code, currencyCode),
    });

    const [newWallet] = await this.drizzleClient.insert(walletsTable).values({
      userId: data.userId,
      currencyCode,
      status: 'active',
    }).onConflictDoNothing().returning();

    if (newWallet) {
      const walletWithCurrency = { ...newWallet, currency: currency ?? null };
      return {
        success: true,
        message: 'Wallet created successfully',
        wallet: WalletMapper.toProto(walletWithCurrency),
      };
    }

    // Wallet already exists — return existing
    const existingWallet = await this.drizzleClient.query.walletsTable.findFirst({
      where: eq(walletsTable.userId, data.userId),
      with: { currency: true },
    });

    if (!existingWallet) {
      throw new RpcNotFoundError('Wallet not found after create attempt');
    }

    return {
      success: true,
      message: 'Wallet already exists',
      wallet: WalletMapper.toProto(existingWallet),
    };
  }

  // ===========================
  // GetWalletByUserId
  // ===========================
  async getWalletByUserId(data: GetWalletByUserIdRequest): Promise<GetWalletResponse> {
    const wallet = await this.drizzleClient.query.walletsTable.findFirst({
      where: eq(walletsTable.userId, data.userId),
      with: { currency: true },
    });

    if (!wallet) {
      throw new RpcNotFoundError('Wallet not found');
    }

    return {
      success: true,
      message: 'Wallet retrieved successfully',
      wallet: WalletMapper.toProto(wallet),
    };
  }

  // ===========================
  // GetWalletById
  // ===========================
  async getWalletById(data: GetWalletByIdRequest): Promise<GetWalletResponse> {
    const walletId = parseInt(data.walletId, 10);
    if (isNaN(walletId)) {
      throw new RpcPreconditionFailedError('Invalid wallet ID');
    }

    const wallet = await this.drizzleClient.query.walletsTable.findFirst({
      where: eq(walletsTable.id, walletId),
      with: { currency: true },
    });

    if (!wallet) {
      throw new RpcNotFoundError('Wallet not found');
    }

    return {
      success: true,
      message: 'Wallet retrieved successfully',
      wallet: WalletMapper.toProto(wallet),
    };
  }

  // ===========================
  // CreditWallet
  // ===========================
  async creditWallet(data: CreditWalletRequest): Promise<WalletMutationResponse> {
    const wallet = await this.drizzleClient.query.walletsTable.findFirst({
      where: eq(walletsTable.userId, data.userId),
      with: { currency: true },
    });

    if (!wallet) {
      throw new RpcNotFoundError('Wallet not found');
    }

    const [updatedWallet] = await this.drizzleClient.update(walletsTable).set({
      totalBalance: sql`${walletsTable.totalBalance} + ${Math.abs(data.amountMinor)}`,
      availableBalance: sql`${walletsTable.availableBalance} + ${Math.abs(data.amountMinor)}`,
    }).where(eq(walletsTable.id, wallet.id)).returning();

    const [transaction] = await this.drizzleClient.insert(transactionsTable).values({
      walletId: wallet.id,
      userId: data.userId,
      amountMinor: Math.abs(data.amountMinor),
      direction: 'credit',
      entryType: data.referenceType || 'deposit',
      referenceType: data.referenceType || null,
      referenceId: data.referenceId || null,
      note: data.note || null,
      status: 'completed',
    }).returning();

    return {
      success: true,
      message: 'Wallet credited successfully',
      wallet: WalletMapper.toProto({ ...updatedWallet, currency: wallet.currency }),
      transaction: WalletMapper.transactionToProto(transaction),
    };
  }

  // ===========================
  // DebitWallet
  // ===========================
  async debitWallet(data: DebitWalletRequest): Promise<WalletMutationResponse> {
    const wallet = await this.drizzleClient.query.walletsTable.findFirst({
      where: eq(walletsTable.userId, data.userId),
      with: { currency: true },
    });

    if (!wallet) {
      throw new RpcNotFoundError('Wallet not found');
    }

    const amount = Math.abs(data.amountMinor);

    if (wallet.availableBalance < amount) {
      throw new RpcPreconditionFailedError('Insufficient available balance');
    }

    const [updatedWallet] = await this.drizzleClient.update(walletsTable).set({
      totalBalance: sql`${walletsTable.totalBalance} - ${amount}`,
      availableBalance: sql`${walletsTable.availableBalance} - ${amount}`,
    }).where(eq(walletsTable.id, wallet.id)).returning();

    const [transaction] = await this.drizzleClient.insert(transactionsTable).values({
      walletId: wallet.id,
      userId: data.userId,
      amountMinor: amount,
      direction: 'debit',
      entryType: data.referenceType || 'withdrawal',
      referenceType: data.referenceType || null,
      referenceId: data.referenceId || null,
      note: data.note || null,
      status: 'completed',
    }).returning();

    return {
      success: true,
      message: 'Wallet debited successfully',
      wallet: WalletMapper.toProto({ ...updatedWallet, currency: wallet.currency }),
      transaction: WalletMapper.transactionToProto(transaction),
    };
  }

  // ===========================
  // ListWalletTransactions
  // ===========================
  async listWalletTransactions(data: ListWalletTransactionsRequest): Promise<ListWalletTransactionsResponse> {
    const page = data.pagination?.page ?? 1;
    const limit = data.pagination?.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [eq(transactionsTable.userId, data.userId)];

    if (data.referenceType) {
      conditions.push(eq(transactionsTable.referenceType, data.referenceType));
    }
    if (data.referenceId) {
      conditions.push(eq(transactionsTable.referenceId, data.referenceId));
    }

    const whereClause = and(...conditions);

    const [transactions, [totalResult]] = await Promise.all([
      this.drizzleClient.query.transactionsTable.findMany({
        where: whereClause,
        orderBy: desc(transactionsTable.createdAt),
        limit,
        offset,
      }),
      this.drizzleClient.select({ total: count() }).from(transactionsTable).where(whereClause),
    ]);

    const total = totalResult?.total ?? 0;

    return {
      success: true,
      transactions: transactions.map(WalletMapper.transactionToProto),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===========================
  // RequestWithdrawal
  // ===========================
  async requestWithdrawal(data: RequestWithdrawalRequest): Promise<RequestWithdrawalResponse> {
    const wallet = await this.drizzleClient.query.walletsTable.findFirst({
      where: eq(walletsTable.userId, data.userId),
      with: { currency: true },
    });

    if (!wallet) {
      throw new RpcNotFoundError('Wallet not found');
    }

    const amount = Math.abs(data.amountMinor);

    if (wallet.availableBalance < amount) {
      throw new RpcPreconditionFailedError('Insufficient available balance for withdrawal');
    }

    // Hold the amount: move from available to held
    await this.drizzleClient.update(walletsTable).set({
      availableBalance: sql`${walletsTable.availableBalance} - ${amount}`,
      heldBalance: sql`${walletsTable.heldBalance} + ${amount}`,
    }).where(eq(walletsTable.id, wallet.id));

    // Record the transaction as pending
    const [transaction] = await this.drizzleClient.insert(transactionsTable).values({
      walletId: wallet.id,
      userId: data.userId,
      amountMinor: amount,
      direction: 'debit',
      entryType: 'withdrawal',
      referenceType: 'withdrawal',
      referenceId: null,
      note: `Withdrawal to ${data.bankCode} ****${data.accountNumber.slice(-4)}`,
      status: 'pending',
    }).returning();

    return {
      success: true,
      message: 'Withdrawal request submitted',
      withdrawal: {
        withdrawalId: transaction.id.toString(),
        walletId: wallet.id.toString(),
        userId: data.userId,
        amountMinor: amount,
        currency: wallet.currency ? {
          code: 0,
          name: wallet.currency.name,
          symbol: wallet.currency.symbol,
        } : undefined,
        status: 1, // PENDING
        bankCode: data.bankCode,
        accountNumberLast4: data.accountNumber.slice(-4),
        accountName: data.accountName,
        providerReference: '',
        failureReason: '',
        createdAt: WalletMapper.toTimestamp(transaction.createdAt),
        updatedAt: undefined,
      },
    };
  }

  // ===========================
  // ListWithdrawals
  // ===========================
  async listWithdrawals(data: ListWithdrawalsRequest): Promise<ListWithdrawalsResponse> {
    const page = data.pagination?.page ?? 1;
    const limit = data.pagination?.limit ?? 20;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(transactionsTable.userId, data.userId),
      eq(transactionsTable.entryType, 'withdrawal'),
    ];

    if (data.status) {
      // Map proto WithdrawalStatus enum to DB status string
      const statusMap: Record<number, string> = {
        1: 'pending',
        2: 'pending', // processing → pending
        3: 'completed', // success
        4: 'failed',
        5: 'reversed', // cancelled → reversed
      };
      const dbStatus = statusMap[data.status];
      if (dbStatus) {
        conditions.push(eq(transactionsTable.status, dbStatus));
      }
    }

    const whereClause = and(...conditions);

    const [withdrawals, [totalResult]] = await Promise.all([
      this.drizzleClient.query.transactionsTable.findMany({
        where: whereClause,
        orderBy: desc(transactionsTable.createdAt),
        limit,
        offset,
      }),
      this.drizzleClient.select({ total: count() }).from(transactionsTable).where(whereClause),
    ]);

    const total = totalResult?.total ?? 0;

    return {
      success: true,
      withdrawals: withdrawals.map((tx) => ({
        withdrawalId: tx.id.toString(),
        walletId: tx.walletId.toString(),
        userId: tx.userId,
        amountMinor: tx.amountMinor,
        currency: undefined,
        status: 0,
        bankCode: '',
        accountNumberLast4: '',
        accountName: '',
        providerReference: '',
        failureReason: '',
        createdAt: WalletMapper.toTimestamp(tx.createdAt),
        updatedAt: tx.processedAt ? WalletMapper.toTimestamp(tx.processedAt) : undefined,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}