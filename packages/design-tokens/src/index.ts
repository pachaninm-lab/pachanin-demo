import tokens from './tokens.json';

export { tokens };
export type DesignTokenTree = typeof tokens;

export const densityProfiles = {
  compact: 'compact',
  comfortable: 'comfortable',
  field: 'field',
} as const;

export type DensityProfile = (typeof densityProfiles)[keyof typeof densityProfiles];
