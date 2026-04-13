import { Inject } from '@nestjs/common';
import { DRIZZLE_SERVICE_TAG } from './drizzle.definition';

export const InjectDrizzle = (tag: string = DRIZZLE_SERVICE_TAG) => {
  return Inject(tag);
};