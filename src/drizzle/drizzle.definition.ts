import { type DrizzleSchemaType } from '@/database/types';
import { ConfigurableModuleBuilder } from '@nestjs/common';
import { DrizzleConfigInterface } from './drizzle.interface';

export const DRIZZLE_SERVICE_TAG = 'db';

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN,
  OPTIONS_TYPE,
  ASYNC_OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<DrizzleConfigInterface<DrizzleSchemaType>>()
  .setExtras(
    {
      tag: DRIZZLE_SERVICE_TAG,
    },
    (definition, extras) => ({
      ...definition,
      tag: extras.tag,
    })
  )
  .build();
