import { DrizzleSchemaType } from '@/database/types';
import { DynamicModule, Global } from '@nestjs/common';
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  DRIZZLE_SERVICE_TAG,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
} from './drizzle.definition';
import { DrizzleConfigInterface } from './drizzle.interface';
import { DrizzleService } from './drizzle.service';

@Global()
export class DrizzleModule extends ConfigurableModuleClass {
  static register(options: typeof OPTIONS_TYPE): DynamicModule {
    const { providers = [], exports = [], ...props } = super.register(options);
    return {
      ...props,
      providers: [
        ...providers,
        DrizzleService,
        {
          provide: options?.tag || DRIZZLE_SERVICE_TAG,
          useFactory: async (drizzleService: DrizzleService) => {
            return await drizzleService.getDrizzle(options);
          },
          inject: [DrizzleService],
        },
      ],
      exports: [...exports, options?.tag || DRIZZLE_SERVICE_TAG],
    };
  }

  static registerAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    const {
      providers = [],
      exports = [],
      ...props
    } = super.registerAsync(options);
    return {
      ...props,
      providers: [
        ...providers,
        DrizzleService,
        {
          provide: options?.tag || DRIZZLE_SERVICE_TAG,
          useFactory: async (
            drizzleService: DrizzleService,
            config: DrizzleConfigInterface<DrizzleSchemaType>
          ) => {
            return await drizzleService.getDrizzle(config);
          },
          inject: [DrizzleService, MODULE_OPTIONS_TOKEN],
        },
      ],
      exports: [...exports, options?.tag || DRIZZLE_SERVICE_TAG],
    };
  }
}