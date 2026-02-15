export const WalletStatusConst = {
  ACTIVE: 'active',
  FROZEN: 'frozen',
  CLOSED: 'closed',
} as const;
export type WalletStatusType = (typeof WalletStatusConst)[keyof typeof WalletStatusConst];