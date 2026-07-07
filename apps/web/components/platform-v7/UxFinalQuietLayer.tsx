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

      .pc-shell-root-v4 [data-testid^="role-intent-surface-"] h2 + div {
        display: none !important;
      }

      .pc-shell-root-v4 [data-testid^="role-execution-summary-"] {
        gap: 14px !important;
      }

      @media (max-width: 640px) {
        .pc-shell-root-v4 [data-testid^="role-execution-summary-"] {
          gap: 12px !important;
        }
      }
    `}</style>
  );
}
