'use client';

export function PublicHeaderFinalLock() {
  return (
    <style>{`
      .entry-header-actions,
      .login-top,
      .login-header,
      .p7-demo-header-actions,
      .p7-contact-nav,
      .p7-register-actions,
      .p7-contact-fixed-actions,
      .pc-v4-actions {
        display: flex !important;
        align-items: center !important;
      }

      .entry-header-actions .p7-translator-slot,
      .login-top .p7-translator-slot,
      .login-header .p7-translator-slot,
      .p7-demo-header-actions .p7-translator-slot,
      .p7-contact-nav .p7-translator-slot,
      .p7-register-actions .p7-translator-slot,
      .p7-contact-fixed-actions .p7-translator-slot,
      .pc-v4-actions .p7-translator-slot {
        display: inline-flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        flex: 0 0 auto !important;
        pointer-events: auto !important;
      }

      .entry-header-actions .p7-translator-button,
      .login-top .p7-translator-button,
      .login-header .p7-translator-button,
      .p7-demo-header-actions .p7-translator-button,
      .p7-contact-nav .p7-translator-button,
      .p7-register-actions .p7-translator-button,
      .p7-contact-fixed-actions .p7-translator-button {
        width: 42px !important;
        min-width: 42px !important;
        height: 42px !important;
        padding: 0 !important;
      }

      .entry-header-actions .p7-translator-button span,
      .entry-header-actions .p7-translator-button b,
      .login-top .p7-translator-button span,
      .login-top .p7-translator-button b,
      .login-header .p7-translator-button span,
      .login-header .p7-translator-button b,
      .p7-demo-header-actions .p7-translator-button span,
      .p7-demo-header-actions .p7-translator-button b,
      .p7-contact-nav .p7-translator-button span,
      .p7-contact-nav .p7-translator-button b,
      .p7-register-actions .p7-translator-button span,
      .p7-register-actions .p7-translator-button b,
      .p7-contact-fixed-actions .p7-translator-button span,
      .p7-contact-fixed-actions .p7-translator-button b {
        display: none !important;
      }

      .p7-translator-fallback {
        top: calc(env(safe-area-inset-top) + 12px) !important;
        right: 12px !important;
        z-index: 3600 !important;
      }

      @media (max-width: 720px) {
        .entry-header {
          grid-template-columns: minmax(0, 1fr) auto !important;
        }

        .entry-header-actions {
          gap: 8px !important;
          min-width: max-content !important;
        }

        .entry-login {
          min-width: 84px !important;
          flex: 0 0 auto !important;
        }

        .entry-brand {
          max-width: calc(100dvw - 188px) !important;
          overflow: hidden !important;
        }
      }
    `}</style>
  );
}
