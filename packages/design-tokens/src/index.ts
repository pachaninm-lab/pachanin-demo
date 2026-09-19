export const designTokenVersion = '8.0.0-foundation' as const;

export const designTokenCssVariables = {
  canvas: '--ds-color-canvas',
  surface: '--ds-color-surface',
  surfaceSubtle: '--ds-color-surface-subtle',
  textPrimary: '--ds-color-text-primary',
  textSecondary: '--ds-color-text-secondary',
  textMuted: '--ds-color-text-muted',
  border: '--ds-color-border',
  focus: '--ds-color-focus',
  actionPrimary: '--ds-color-action-primary',
  actionPrimaryHover: '--ds-color-action-primary-hover',
  actionPrimarySubtle: '--ds-color-action-primary-subtle',
  statusSuccess: '--ds-color-success',
  statusWarning: '--ds-color-warning',
  statusCritical: '--ds-color-critical',
  statusInformation: '--ds-color-information',
  controlHeight: '--ds-control-height',
} as const;

export type DesignTokenCssVariable = typeof designTokenCssVariables[keyof typeof designTokenCssVariables];
