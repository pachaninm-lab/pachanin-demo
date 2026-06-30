import type { ReactNode } from 'react';

export default function PlatformV7DemoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        html body .pc-shell-root-v4:has(.p7-demo-page) .p7-demo-page {
          padding-top: 86px !important;
        }

        html body .pc-shell-root-v4:has(.p7-demo-page) .p7-demo-header {
          position: fixed !important;
          top: max(8px, env(safe-area-inset-top)) !important;
          left: clamp(14px, 4vw, 56px) !important;
          right: clamp(14px, 4vw, 56px) !important;
          width: auto !important;
          height: 64px !important;
          min-height: 64px !important;
          max-height: 64px !important;
          z-index: 7000 !important;
          padding: 8px 106px 8px 12px !important;
          display: block !important;
          overflow: hidden !important;
        }

        html body .pc-shell-root-v4:has(.p7-demo-page) .p7-demo-header-actions {
          position: absolute !important;
          top: 50% !important;
          right: 10px !important;
          transform: translateY(-50%) !important;
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: nowrap !important;
          align-items: center !important;
          justify-content: flex-end !important;
          gap: 7px !important;
          width: auto !important;
          height: 44px !important;
          min-width: 91px !important;
          visibility: visible !important;
          opacity: 1 !important;
          pointer-events: auto !important;
          z-index: 7010 !important;
        }

        html body .pc-shell-root-v4:has(.p7-demo-page) .p7-demo-icon-button {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          width: 42px !important;
          height: 42px !important;
          min-width: 42px !important;
          max-width: 42px !important;
          flex: 0 0 42px !important;
          visibility: visible !important;
          opacity: 1 !important;
        }

        @media (max-width: 860px) {
          html body .pc-shell-root-v4:has(.p7-demo-page) .p7-demo-page {
            padding-top: 82px !important;
          }

          html body .pc-shell-root-v4:has(.p7-demo-page) .p7-demo-header {
            top: max(6px, env(safe-area-inset-top)) !important;
            left: 8px !important;
            right: 8px !important;
            padding-right: 98px !important;
          }
        }

        @media (max-width: 520px) {
          html body .pc-shell-root-v4:has(.p7-demo-page) .p7-demo-page {
            padding-top: 80px !important;
          }

          html body .pc-shell-root-v4:has(.p7-demo-page) .p7-demo-header {
            left: 8px !important;
            right: 8px !important;
            padding-right: 94px !important;
            margin: 0 !important;
          }

          html body .pc-shell-root-v4:has(.p7-demo-page) .p7-demo-header-actions {
            right: 8px !important;
            gap: 6px !important;
          }

          html body .pc-shell-root-v4:has(.p7-demo-page) .p7-demo-icon-button {
            width: 40px !important;
            height: 40px !important;
            min-width: 40px !important;
            max-width: 40px !important;
            flex-basis: 40px !important;
          }
        }
      `}</style>
      {children}
    </>
  );
}
