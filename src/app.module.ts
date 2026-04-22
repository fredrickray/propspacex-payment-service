import { appConfig, dbConfig, paystackConfig } from '@/config';
import * as schema from '@/database/schemas';
import { DRIZZLE_SERVICE_TAG } from '@/drizzle/drizzle.definition';
import { DrizzleModule } from '@/drizzle/drizzle.module';
import { PaymentModule } from '@/v1/payment/payment.module';
import { WalletModule } from '@/v1/wallet/wallet.module';
import { WebhookModule } from '@/v1/webhook/webhook.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [dbConfig, appConfig, paystackConfig],
    }),
    DrizzleModule.registerAsync({
      inject: [ConfigService],
      tag: DRIZZLE_SERVICE_TAG,
      useFactory: (configService: ConfigService) => ({
        pg: {
          connection: 'client',
          config: {
            connectionString: configService.get('db.url'),
          }
        },
        config: {
          schema: { ...schema },
        }
      })
    }),
    WalletModule,
    PaymentModule,
    WebhookModule
  ],
})
export class AppModule { }
