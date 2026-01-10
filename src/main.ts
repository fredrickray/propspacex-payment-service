import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { showStartupBanner } from '@common/utils/startup-banner';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  showStartupBanner({
    appName: 'PropSpaceX Payment Service',
    port,
    environment: process.env.NODE_ENV,
  });
}
bootstrap().catch((err) => {
  Logger.error('Error during application bootstrap:', err);
  process.exit(1);
});
