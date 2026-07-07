'use client';

export function UxFinalQuietLayer() {
  return (
    <style>{`
      .pc-shell-root-v4 [data-testid^="role-execution-summary-"] h1,
      .pc-shell-root-v4 [data-testid^="role-execution-summary-"] h1 + p,
      .pc-shell-root-v4 [data-testid^="role-execution-summary-"] [aria-label="Логика работы"] {
        display: none !important;
      }

      .pc-shell-root-v4 [data-testid^="role-execution-summary-"] [data-testid^="role-primary-task-"] > div > span:first-child {
        display: none !important;
      }

      .pc-shell-root-v4 [data-testid^="role-intent-surface-"] h2 + div,
      .pc-shell-root-v4 [data-testid="platform-v7-role-workspace-hint"] {
        display: none !important;
      }

      .pc-shell-root-v4 [data-testid^="role-execution-summary-"] {
        gap: 12px !important;
      }

      .pc-shell-root-v4 [data-testid^="role-intent-surface-"] {
        padding: 14px !important;
      }

      .pc-shell-root-v4 [data-testid^="role-intent-surface-"] h2 {
        font-size: 16px !important;
        line-height: 1.2 !important;
      }

      .pc-shell-root-v4 [data-testid^="role-execution-summary-"] a {
        -webkit-tap-highlight-color: transparent !important;
      }

      @media (max-width: 640px) {
        .pc-shell-root-v4 [data-testid^="role-execution-summary-"] {
          gap: 10px !important;
        }

        .pc-shell-root-v4 [data-testid^="role-intent-surface-"] {
          padding: 12px !important;
        }

        .pc-shell-root-v4 [data-testid^="role-intent-surface-"] h2 {
          font-size: 15px !important;
        }

        .pc-shell-root-v4 [data-testid^="role-primary-task-"] {
          padding: 12px !important;
        }

        .pc-shell-root-v4 .pc-v7-assistant-widget {
          right: 12px !important;
          bottom: calc(env(safe-area-inset-bottom) + 82px) !important;
          width: 42px !important;
          min-width: 42px !important;
          max-width: 42px !important;
          min-height: 42px !important;
          padding: 0 !important;
          justify-content: center !important;
          border-radius: 15px !important;
        }

        .pc-shell-root-v4 .pc-v7-assistant-widget span {
          display: none !important;
        }
      }
    `}</style>
  );
}
