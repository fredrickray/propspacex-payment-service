// Enum values matching proto/payment/v1/payment.proto

export enum CurrencyCode {
  UNSPECIFIED = 0,
  NGN = 1,
  USD = 2,
}

export enum WalletStatus {
  UNSPECIFIED = 0,
  ACTIVE = 1,
  FROZEN = 2,
  CLOSED = 3,
}

// Maps DB string status to proto enum value
export const WalletStatusToProto: Record<string, WalletStatus> = {
  active: WalletStatus.ACTIVE,
  frozen: WalletStatus.FROZEN,
  closed: WalletStatus.CLOSED,
};

// Maps proto enum value to DB string status
export const WalletStatusFromProto: Record<number, string> = {
  [WalletStatus.ACTIVE]: 'active',
  [WalletStatus.FROZEN]: 'frozen',
  [WalletStatus.CLOSED]: 'closed',
};

// Maps DB currency code string to proto enum value
export const CurrencyCodeToProto: Record<string, CurrencyCode> = {
  NGN: CurrencyCode.NGN,
  USD: CurrencyCode.USD,
};

// Maps proto enum value to DB currency code string
export const CurrencyCodeFromProto: Record<number, string> = {
  [CurrencyCode.NGN]: 'NGN',
  [CurrencyCode.USD]: 'USD',
};