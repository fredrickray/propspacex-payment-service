// These are types not generated from the proto but are used in the wallet feature

export type WalletBalanceChangeType = 'increase' | 'decrease';

export type IncreaseOrDecreaseWalletBalanceReq = {
  userId: string;
  type: WalletBalanceChangeType;
  totalBalance: number;
  availableBalance: number;
}