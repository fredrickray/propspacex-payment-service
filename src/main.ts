import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { showStartupBanner } from '@/common/utils/startup-banner';
import { DrizzleDatabaseType } from '@/database/types';
import { DRIZZLE_SERVICE_TAG } from '@/drizzle/drizzle.definition';
import { seedDefaultData } from '@/seeds';
import { WALLET_PACKAGE_NAME } from '@/v1/wallet/wallet';
import { ReflectionService } from '@grpc/reflection';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose']
  });

  await ConfigModule.envVariablesLoaded;

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  const configService = app.get(ConfigService);

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: [WALLET_PACKAGE_NAME],
      protoPath: [join(__dirname, 'v1/wallet/wallet.proto')],
      url: `${configService.get('app.host')}:${configService.get('app.port')}`,
      onLoadPackageDefinition: (pkg, server) => {
        new ReflectionService(pkg).addToServer(server);
      },
    },
  }, {
    /**
     * This is needed because there are multiple microservices running on the same server.
     * If we don't inherit the app config, the microservices will not be able to access the config like filters, pipes, etc.
     * @link https://docs.nestjs.com/faq/hybrid-application 
     */
    inheritAppConfig: true,
  });

  const db = app.get<DrizzleDatabaseType>(DRIZZLE_SERVICE_TAG);
  await migrate(db, { migrationsFolder: join(process.cwd(), 'src/database/migrations') })
  await seedDefaultData(db);
  await app.startAllMicroservices();

  showStartupBanner({
    appName: configService.get('app.name'),
    port: configService.get('app.port') as number,
    environment: configService.get('app.environment'),
  });
}

bootstrap().catch((err) => {
  Logger.error('Error during application bootstrap:', err);
  process.exit(1);
});
