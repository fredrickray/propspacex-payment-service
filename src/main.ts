import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { showStartupBanner } from '@/common/utils/startup-banner';
import { DrizzleDatabaseType } from '@/database/types';
import { DRIZZLE_SERVICE_TAG } from '@/drizzle/drizzle.definition';
import { seedDefaultData } from '@/seeds';
import { ReflectionService } from '@grpc/reflection';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const PAYMENT_PACKAGE_NAME = 'payment';
  const PAYMENT_PROTO_PATH = join(process.cwd(), 'proto', 'payment', 'v1', 'payment.proto');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose']
  });

  await ConfigModule.envVariablesLoaded;

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  const configService = app.get(ConfigService);

  const { host, grpcPort, paymentServicePort, environment } = configService.get('app') as Record<string, string>;

  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: [PAYMENT_PACKAGE_NAME],
      protoPath: [PAYMENT_PROTO_PATH],
      url: `${host}:${grpcPort}`,
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

  app.setGlobalPrefix('/api')
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // this is for the http server for the webhooks. The webhook server cannot listen on the same port as the gRPC microservice.
  await app.listen(paymentServicePort);

  showStartupBanner({
    appName: configService.get('app.name'),
    grpcPort,
    paymentServicePort,
    environment,
    host: host,
  });
}

bootstrap().catch((err) => {
  Logger.error('Error during application bootstrap:', err);
  process.exit(1);
});
