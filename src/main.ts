import { AllExceptionsFilter } from '@/common/filters/all-exceptions.filter';
import { showStartupBanner } from '@/common/utils/startup-banner';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  await ConfigModule.envVariablesLoaded;

  const configService = app.get(ConfigService);

  await app.listen(configService.get('app.port') as number);

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
