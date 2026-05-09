import { AnchorType } from '@localloop/shared-types';

export const DEFAULT_RADIUS_KM_BY_ANCHOR: Record<AnchorType, number> = {
  [AnchorType.ESTABLISHMENT]: 0.1,
  [AnchorType.CONDO]: 0.1,
  [AnchorType.EVENT]: 0.5,
  [AnchorType.NEIGHBORHOOD]: 2,
  [AnchorType.CITY]: 50,
};

export const RADIUS_KM_MIN = 0.05;
export const RADIUS_KM_MAX = 50;
