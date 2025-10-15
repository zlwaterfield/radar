import { SetMetadata } from '@nestjs/common';

export const REQUIRED_FEATURE_KEY = 'requiredFeature';
export const RequireFeature = (featureLookupKey: string) =>
  SetMetadata(REQUIRED_FEATURE_KEY, featureLookupKey);
