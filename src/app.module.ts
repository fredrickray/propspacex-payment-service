import { appConfig, dbConfig } from '@/config';
import * as schema from '@/database/schemas';
import { DRIZZLE_SERVICE_TAG } from '@/drizzle/drizzle.definition';
import { DrizzleModule } from '@/drizzle/drizzle.module';
import { WALLET_PACKAGE_NAME } from '@/v1/wallet/wallet';
import { WalletModule } from '@/v1/wallet/wallet.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [dbConfig, appConfig],
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
    // Load other microservices here when we want them to call each other within the server
    ClientsModule.register([
      {
        name: WALLET_PACKAGE_NAME,
        transport: Transport.GRPC,
        options: {
          package: [WALLET_PACKAGE_NAME],
          protoPath: [join(__dirname, 'v1/wallet/wallet.proto')],
        },
      }
    ]),
    WalletModule
  ],
})
export class AppModule { }
