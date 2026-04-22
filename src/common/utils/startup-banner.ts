import { Logger } from '@nestjs/common';

interface StartupBannerOptions {
  appName?: string;
  grpcPort: number | string;
  paymentServicePort: number | string;
  environment?: string;
  host?: string;
}

export function showStartupBanner(options: StartupBannerOptions): void {
  const {
    appName = 'PropSpaceX Payment Service',
    grpcPort,
    paymentServicePort,
    environment = 'development',
    host = 'localhost',
  } = options;

  const grpcUrl = `${host}:${grpcPort}`;
  const paymentUrl = `http://${host}:${paymentServicePort}`;

  Logger.log('=================================================');
  Logger.log(` 🚀 ${appName} is live and ready for action`);
  Logger.log('=================================================');
  Logger.log('⛓️ Payment Service: Blockchain secured!');
  Logger.log('  [====]   [====]');
  Logger.log('     |       |');
  Logger.log('  [====]---[====]');
  Logger.log('     |       |');
  Logger.log('  [====]   [====]');
  Logger.log(` 🌍 Environment : ${environment}`);
  Logger.log(` 🔗 gRPC Server on: ${grpcUrl}`);
  Logger.log(` 🔗 Payment Server (HTTP) on: ${paymentUrl}`);
  Logger.log('PropSpaceX: Trustless, transparent transactions!');
  Logger.log('=================================================');
}
