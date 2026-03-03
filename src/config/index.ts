import { registerAs } from "@nestjs/config";

export const dbConfig = registerAs('db', () => ({
  logging: process.env.DB_LOGGING === 'true',
  url: process.env.DB_URL,
}));

export const appConfig = registerAs('app', () => ({
  name: process.env.APP_NAME,
  host: process.env.HOST || 'localhost',
  port: +(process.env.PORT || 8080),
  environment: process.env.NODE_ENV,
}))

export type AppConfigType = {
  db: ReturnType<typeof dbConfig>;
  app: ReturnType<typeof appConfig>;
}