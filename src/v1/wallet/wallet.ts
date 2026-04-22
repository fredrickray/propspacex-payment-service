/**
 * Types matching proto/payment/v1/payment.proto — WalletService
 * These are hand-written to match the canonical proto definitions.
 * When you regenerate with protoc, replace this file with the generated output.
 */

import { GrpcMethod, GrpcStreamMethod } from "@nestjs/microservices";

export const PAYMENT_PACKAGE_NAME = "payment";

// ===========================
// Shared types
// ===========================

export interface Timestamp {
  seconds: number;
  nanos: number;
}

export interface PaginationRequest {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Currency {
  code: number; // CurrencyCode enum
  name: string;
  symbol: string;
}

// ===========================
// Wallet types
// ===========================

export interface Wallet {
  walletId: string;
  userId: string;
  status: number; // WalletStatus enum
  currency: Currency | undefined;
  totalBalanceMinor: number;
  availableBalanceMinor: number;
  heldBalanceMinor: number;
  createdAt: Timestamp | undefined;
  updatedAt: Timestamp | undefined;
}

export interface WalletTransaction {
  transactionId: string;
  walletId: string;
  userId: string;
  amountMinor: number;
  direction: string;
  entryType: string;
  referenceType: string;
  referenceId: string;
  note: string;
  createdAt: Timestamp | undefined;
}

export interface Withdrawal {
  withdrawalId: string;
  walletId: string;
  userId: string;
  amountMinor: number;
  currency: Currency | undefined;
  status: number;
  bankCode: string;
  accountNumberLast4: string;
  accountName: string;
  providerReference: string;
  failureReason: string;
  createdAt: Timestamp | undefined;
  updatedAt: Timestamp | undefined;
}

// ===========================
// Request types
// ===========================

export interface CreateWalletRequest {
  userId: string;
  currencyCode: number; // CurrencyCode enum
}

export interface GetWalletByUserIdRequest {
  userId: string;
}

export interface GetWalletByIdRequest {
  walletId: string;
}

export interface CreditWalletRequest {
  userId: string;
  amountMinor: number;
  referenceType: string;
  referenceId: string;
  note: string;
  idempotencyKey: string;
}

export interface DebitWalletRequest {
  userId: string;
  amountMinor: number;
  referenceType: string;
  referenceId: string;
  note: string;
  idempotencyKey: string;
}

export interface ListWalletTransactionsRequest {
  userId: string;
  pagination: PaginationRequest | undefined;
  referenceType: string;
  referenceId: string;
}

export interface RequestWithdrawalRequest {
  userId: string;
  amountMinor: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  idempotencyKey: string;
}

export interface ListWithdrawalsRequest {
  userId: string;
  pagination: PaginationRequest | undefined;
  status: number;
}

// ===========================
// Response types
// ===========================

export interface CreateWalletResponse {
  success: boolean;
  message: string;
  wallet: Wallet | undefined;
}

export interface GetWalletResponse {
  success: boolean;
  message: string;
  wallet: Wallet | undefined;
}

export interface WalletMutationResponse {
  success: boolean;
  message: string;
  wallet: Wallet | undefined;
  transaction: WalletTransaction | undefined;
}

export interface ListWalletTransactionsResponse {
  success: boolean;
  transactions: WalletTransaction[];
  meta: PaginationMeta | undefined;
}

export interface RequestWithdrawalResponse {
  success: boolean;
  message: string;
  withdrawal: Withdrawal | undefined;
}

export interface ListWithdrawalsResponse {
  success: boolean;
  withdrawals: Withdrawal[];
  meta: PaginationMeta | undefined;
}

// ===========================
// Service interfaces
// ===========================

export interface WalletServiceController {
  createWallet(request: CreateWalletRequest): Promise<CreateWalletResponse> | CreateWalletResponse;
  getWalletByUserId(request: GetWalletByUserIdRequest): Promise<GetWalletResponse> | GetWalletResponse;
  getWalletById(request: GetWalletByIdRequest): Promise<GetWalletResponse> | GetWalletResponse;
  creditWallet(request: CreditWalletRequest): Promise<WalletMutationResponse> | WalletMutationResponse;
  debitWallet(request: DebitWalletRequest): Promise<WalletMutationResponse> | WalletMutationResponse;
  listWalletTransactions(request: ListWalletTransactionsRequest): Promise<ListWalletTransactionsResponse> | ListWalletTransactionsResponse;
  requestWithdrawal(request: RequestWithdrawalRequest): Promise<RequestWithdrawalResponse> | RequestWithdrawalResponse;
  listWithdrawals(request: ListWithdrawalsRequest): Promise<ListWithdrawalsResponse> | ListWithdrawalsResponse;
}

export function WalletServiceControllerMethods() {
  return function (constructor: Function) {
    const grpcMethods: string[] = [
      "createWallet",
      "getWalletByUserId",
      "getWalletById",
      "creditWallet",
      "debitWallet",
      "listWalletTransactions",
      "requestWithdrawal",
      "listWithdrawals",
    ];
    for (const method of grpcMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
      GrpcMethod("WalletService", method)(constructor.prototype[method], method, descriptor);
    }
    const grpcStreamMethods: string[] = [];
    for (const method of grpcStreamMethods) {
      const descriptor: any = Reflect.getOwnPropertyDescriptor(constructor.prototype, method);
      GrpcStreamMethod("WalletService", method)(constructor.prototype[method], method, descriptor);
    }
  };
}

export const WALLET_SERVICE_NAME = "WalletService";
