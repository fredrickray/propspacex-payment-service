import { registerAs } from "@nestjs/config"

export const dbConfig = registerAs('db', () => ({
  host: process.env.DB_HOST,
  port: +(process.env.DB_PORT || 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  databaseName: process.env.DB_NAME,
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging: process.env.DB_LOGGING === 'true',
}));

export const appConfig = registerAs('app', () => ({
  name: process.env.APP_NAME,
  port: +(process.env.PORT || 8080),
  environment: process.env.NODE_ENV,
}))

export type AppConfigType = {
  db: ReturnType<typeof dbConfig>;
  app: ReturnType<typeof appConfig>;
}