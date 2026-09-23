export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum PaymentProvider {
  PAYSTACK = 'paystack',
}

export enum PaymentPurpose {
  ESCROW_FUNDING = 'escrow_funding',
  WALLET_TOPUP = 'wallet_topup',
}