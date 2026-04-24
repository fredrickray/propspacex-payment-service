import { registerAs } from "@nestjs/config";

export const dbConfig = registerAs('db', () => ({
  logging: process.env.DB_LOGGING === 'true',
  url: process.env.DB_URL,
}));

export const appConfig = registerAs('app', () => ({
  name: process.env.APP_NAME,
  host: process.env.HOST || 'localhost',
  grpcPort: +(process.env.GRPC_PORT || 50053),
  paymentServicePort: +(process.env.PAYMENT_SERVICE_PORT || 9093),
  environment: process.env.NODE_ENV,
  frontendBaseUrl: process.env.FRONTEND_BASE_URL,
  /** UUID of a wallet user that accrues platform_fee_minor on escrow release (optional). */
  platformWalletUserId: process.env.PLATFORM_WALLET_USER_ID,
}))

export const paystackConfig = registerAs('paystack', () => ({
  secretKey: process.env.PAYSTACK_SECRET_KEY,
}));

export type AppConfigType = {
  db: ReturnType<typeof dbConfig>;
  app: ReturnType<typeof appConfig>;
  paystack: ReturnType<typeof paystackConfig>;
};