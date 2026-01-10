import { Logger } from '@nestjs/common';

interface StartupBannerOptions {
  appName?: string;
  port: number | string;
  environment?: string;
  host?: string;
}

export function showStartupBanner(options: StartupBannerOptions): void {
  const {
    appName = 'PropSpaceX Payment Service',
    port,
    environment = 'development',
    host = 'localhost',
  } = options;

  const url = `http://${host}:${port}`;

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
  Logger.log(` 🔗 Listening on: ${url}`);
  Logger.log('PropSpaceX: Trustless, transparent transactions!');
  Logger.log('=================================================');
}
