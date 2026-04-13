import { Logger } from '@nestjs/common';

interface StartupBannerOptions {
  appName?: string;
  walletServicePort: number | string;
  webhookServicePort: number | string;
  paymentServicePort: number | string;
  environment?: string;
  host?: string;
}

export function showStartupBanner(options: StartupBannerOptions): void {
  const {
    appName = 'PropSpaceX Payment Service',
    walletServicePort,
    webhookServicePort,
    paymentServicePort,
    environment = 'development',
    host = 'localhost',
  } = options;

  const walletUrl = `http://${host}:${walletServicePort}`;
  const webhookUrl = `http://${host}:${webhookServicePort}`;
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
  Logger.log(` 🔗 Wallet Service on: ${walletUrl}`);
  Logger.log(` 🔗 Webhook Server on: ${webhookUrl}`);
  Logger.log(` 🔗 Payment Service on: ${paymentUrl}`);
  Logger.log('PropSpaceX: Trustless, transparent transactions!');
  Logger.log('=================================================');
}
