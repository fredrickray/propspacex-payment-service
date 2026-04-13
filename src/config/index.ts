import { registerAs } from "@nestjs/config";

export const dbConfig = registerAs('db', () => ({
  logging: process.env.DB_LOGGING === 'true',
  url: process.env.DB_URL,
}));

export const appConfig = registerAs('app', () => ({
  name: process.env.APP_NAME,
  host: process.env.HOST || 'localhost',
  walletServicePort: +(process.env.WALLET_SERVICE_PORT || 8080),
  paymentServicePort: +(process.env.PAYMENT_SERVICE_PORT || 8081),
  webhookServicePort: +(process.env.WEBHOOK_SERVICE_PORT || 8082),
  environment: process.env.NODE_ENV,
  frontendBaseUrl: process.env.FRONTEND_BASE_URL,
}))

export const paystackConfig = registerAs('paystack', () => ({
  secretKey: process.env.PAYSTACK_SECRET_KEY,
}));

export type AppConfigType = {
  db: ReturnType<typeof dbConfig>;
  app: ReturnType<typeof appConfig>;
  paystack: ReturnType<typeof paystackConfig>;
}