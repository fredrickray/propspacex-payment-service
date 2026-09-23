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

/** DB handle used for atomic escrow/payment flows (root client or Drizzle transaction). */
export type WalletDb = DrizzleDatabaseType;

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

  // ===========================
  // Ledger helpers (non-gRPC): used inside Drizzle transactions for escrow/payment.
  // Not exposed over gRPC — keeps WalletService RPC behavior unchanged.
  // ===========================

  /** Credit buyer available + total (e.g. provider settlement recorded on-ledger). */
  async ledgerCreditAvailable(
    db: WalletDb,
    params: { userId: string; amountMinor: number; referenceType: string; referenceId: string; entryType: string; note?: string },
  ): Promise<void> {
    const amount = Math.abs(params.amountMinor);
    const wallet = await db.query.walletsTable.findFirst({
      where: eq(walletsTable.userId, params.userId),
    });
    if (!wallet) {
      throw new RpcNotFoundError('Wallet not found');
    }
    await db
      .update(walletsTable)
      .set({
        totalBalance: sql`${walletsTable.totalBalance} + ${amount}`,
        availableBalance: sql`${walletsTable.availableBalance} + ${amount}`,
      })
      .where(eq(walletsTable.id, wallet.id));

    await db.insert(transactionsTable).values({
      walletId: wallet.id,
      userId: params.userId,
      amountMinor: amount,
      direction: 'credit',
      entryType: params.entryType,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      note: params.note ?? null,
      status: 'completed',
    });
  }

  /** Move funds from available → held for an escrow (buyer wallet). */
  async ledgerHoldAvailableForEscrow(
    db: WalletDb,
    params: { userId: string; amountMinor: number; escrowId: string; note?: string },
  ): Promise<void> {
    const amount = Math.abs(params.amountMinor);
    const wallet = await db.query.walletsTable.findFirst({
      where: eq(walletsTable.userId, params.userId),
    });
    if (!wallet) {
      throw new RpcNotFoundError('Wallet not found');
    }
    if (wallet.availableBalance < amount) {
      throw new RpcPreconditionFailedError('Insufficient available balance for escrow hold');
    }
    await db
      .update(walletsTable)
      .set({
        availableBalance: sql`${walletsTable.availableBalance} - ${amount}`,
        heldBalance: sql`${walletsTable.heldBalance} + ${amount}`,
      })
      .where(eq(walletsTable.id, wallet.id));

    await db.insert(transactionsTable).values({
      walletId: wallet.id,
      userId: params.userId,
      amountMinor: amount,
      direction: 'hold',
      entryType: 'escrow_hold',
      referenceType: 'escrow',
      referenceId: params.escrowId,
      note: params.note ?? null,
      status: 'completed',
    });
  }

  /** Release buyer held back to available (cancel / refund while disputed path). */
  async ledgerRefundHeldToAvailable(
    db: WalletDb,
    params: { userId: string; amountMinor: number; escrowId: string; note?: string },
  ): Promise<void> {
    const amount = Math.abs(params.amountMinor);
    const wallet = await db.query.walletsTable.findFirst({
      where: eq(walletsTable.userId, params.userId),
    });
    if (!wallet) {
      throw new RpcNotFoundError('Wallet not found');
    }
    if (wallet.heldBalance < amount) {
      throw new RpcPreconditionFailedError('Insufficient held balance for refund');
    }
    await db
      .update(walletsTable)
      .set({
        heldBalance: sql`${walletsTable.heldBalance} - ${amount}`,
        availableBalance: sql`${walletsTable.availableBalance} + ${amount}`,
      })
      .where(eq(walletsTable.id, wallet.id));

    await db.insert(transactionsTable).values({
      walletId: wallet.id,
      userId: params.userId,
      amountMinor: amount,
      direction: 'release',
      entryType: 'refund',
      referenceType: 'escrow',
      referenceId: params.escrowId,
      note: params.note ?? null,
      status: 'completed',
    });
  }

  /**
   * Consume buyer held escrow amount: reduce buyer held + total, credit agent and optional platform wallets.
   * Assumption: escrowAmountMinor == platformFeeMinor + netToAgentMinor (validated by caller).
   */
  async ledgerDisburseReleasedEscrow(
    db: WalletDb,
    params: {
      buyerUserId: string;
      agentUserId: string;
      platformUserId: string | null;
      escrowAmountMinor: number;
      platformFeeMinor: number;
      netToAgentMinor: number;
      escrowId: string;
      note?: string;
    },
  ): Promise<void> {
    const totalOut = Math.abs(params.escrowAmountMinor);
    const fee = Math.abs(params.platformFeeMinor);
    const net = Math.abs(params.netToAgentMinor);
    if (fee + net !== totalOut) {
      throw new RpcPreconditionFailedError('Escrow disburse amounts must sum to escrow total');
    }
    if (fee > 0 && !params.platformUserId) {
      throw new RpcPreconditionFailedError(
        'Platform wallet user is not configured but escrow has a platform fee',
      );
    }

    const buyerWallet = await db.query.walletsTable.findFirst({
      where: eq(walletsTable.userId, params.buyerUserId),
    });
    const agentWallet = await db.query.walletsTable.findFirst({
      where: eq(walletsTable.userId, params.agentUserId),
    });
    if (!buyerWallet) {
      throw new RpcNotFoundError('Buyer wallet not found');
    }
    if (!agentWallet) {
      throw new RpcNotFoundError('Agent wallet not found');
    }
    if (buyerWallet.heldBalance < totalOut) {
      throw new RpcPreconditionFailedError('Insufficient held balance for escrow release');
    }

    await db
      .update(walletsTable)
      .set({
        heldBalance: sql`${walletsTable.heldBalance} - ${totalOut}`,
        totalBalance: sql`${walletsTable.totalBalance} - ${totalOut}`,
      })
      .where(eq(walletsTable.id, buyerWallet.id));

    await db.insert(transactionsTable).values({
      walletId: buyerWallet.id,
      userId: params.buyerUserId,
      amountMinor: totalOut,
      direction: 'debit',
      entryType: 'escrow_release',
      referenceType: 'escrow',
      referenceId: params.escrowId,
      note: params.note ?? 'Escrow released to agent/platform',
      status: 'completed',
    });

    await db
      .update(walletsTable)
      .set({
        totalBalance: sql`${walletsTable.totalBalance} + ${net}`,
        availableBalance: sql`${walletsTable.availableBalance} + ${net}`,
      })
      .where(eq(walletsTable.id, agentWallet.id));

    await db.insert(transactionsTable).values({
      walletId: agentWallet.id,
      userId: params.agentUserId,
      amountMinor: net,
      direction: 'credit',
      entryType: 'escrow_release',
      referenceType: 'escrow',
      referenceId: params.escrowId,
      note: params.note ?? 'Escrow net credited to agent',
      status: 'completed',
    });

    if (fee > 0 && params.platformUserId) {
      const platformWallet = await db.query.walletsTable.findFirst({
        where: eq(walletsTable.userId, params.platformUserId),
      });
      if (!platformWallet) {
        throw new RpcNotFoundError('Platform wallet not found');
      }
      await db
        .update(walletsTable)
        .set({
          totalBalance: sql`${walletsTable.totalBalance} + ${fee}`,
          availableBalance: sql`${walletsTable.availableBalance} + ${fee}`,
        })
        .where(eq(walletsTable.id, platformWallet.id));

      await db.insert(transactionsTable).values({
        walletId: platformWallet.id,
        userId: params.platformUserId,
        amountMinor: fee,
        direction: 'credit',
        entryType: 'escrow_release',
        referenceType: 'escrow',
        referenceId: params.escrowId,
        note: 'Platform fee from escrow release',
        status: 'completed',
      });
    }
  }

  /** Credit available+total for a user (partial disbursement, e.g. dispute split to buyer). */
  async ledgerCreditAvailableSimple(
    db: WalletDb,
    params: { userId: string; amountMinor: number; escrowId: string; entryType: string; note?: string },
  ): Promise<void> {
    const amount = Math.abs(params.amountMinor);
    if (amount === 0) {
      return;
    }
    const wallet = await db.query.walletsTable.findFirst({
      where: eq(walletsTable.userId, params.userId),
    });
    if (!wallet) {
      throw new RpcNotFoundError('Wallet not found');
    }
    await db
      .update(walletsTable)
      .set({
        totalBalance: sql`${walletsTable.totalBalance} + ${amount}`,
        availableBalance: sql`${walletsTable.availableBalance} + ${amount}`,
      })
      .where(eq(walletsTable.id, wallet.id));

    await db.insert(transactionsTable).values({
      walletId: wallet.id,
      userId: params.userId,
      amountMinor: amount,
      direction: 'credit',
      entryType: params.entryType,
      referenceType: 'escrow',
      referenceId: params.escrowId,
      note: params.note ?? null,
      status: 'completed',
    });
  }

  /**
   * Reduce buyer held (and total) by amount without crediting counterparties — caller credits splits.
   * Used for dispute resolution where awards are credited separately.
   */
  async ledgerConsumeBuyerHeld(
    db: WalletDb,
    params: { buyerUserId: string; amountMinor: number; escrowId: string; note?: string },
  ): Promise<void> {
    const amount = Math.abs(params.amountMinor);
    const wallet = await db.query.walletsTable.findFirst({
      where: eq(walletsTable.userId, params.buyerUserId),
    });
    if (!wallet) {
      throw new RpcNotFoundError('Buyer wallet not found');
    }
    if (wallet.heldBalance < amount) {
      throw new RpcPreconditionFailedError('Insufficient held balance');
    }
    await db
      .update(walletsTable)
      .set({
        heldBalance: sql`${walletsTable.heldBalance} - ${amount}`,
        totalBalance: sql`${walletsTable.totalBalance} - ${amount}`,
      })
      .where(eq(walletsTable.id, wallet.id));

    await db.insert(transactionsTable).values({
      walletId: wallet.id,
      userId: params.buyerUserId,
      amountMinor: amount,
      direction: 'debit',
      entryType: 'escrow_release',
      referenceType: 'escrow',
      referenceId: params.escrowId,
      note: params.note ?? null,
      status: 'completed',
    });
  }
}