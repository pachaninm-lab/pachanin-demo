import { GEKTA_PATHS, type GektaLocale } from '@/lib/gekta/content';

const LABEL: Record<GektaLocale, string> = {
  ru: 'Открыть Гекту — новый диалог',
  en: 'Open Gekta — new conversation',
  zh: '打开 Gekta — 新对话',
};

/**
 * Icon-only floating entry point to the standalone Gekta product.
 *
 * It is a plain server-rendered anchor: no hydration cost on the marketing
 * surface. Any mounted public assistant/contact launcher is the single floating
 * communication surface, so this shortcut yields instead of competing with it.
 * The same authority owns the mobile footer clearance, avoiding two stacked
 * safe-space reserves once the duplicate launcher is removed.
 */
export function GektaFloatingEntry({ locale }: { locale: GektaLocale }) {
  return (
    <>
      <style>{FLOATING_ENTRY_STYLES}</style>
      <a
        className='pc-gekta-floating'
        href={`${GEKTA_PATHS[locale]}?chat=new`}
        aria-label={LABEL[locale]}
        title={LABEL[locale]}
        data-gekta-floating-entry='true'
      >
        <span aria-hidden='true' className='pc-gekta-floating-mark'>G</span>
      </a>
    </>
  );
}

const FLOATING_ENTRY_STYLES = `
.pc-gekta-floating {
  position: fixed;
  right: max(12px, env(safe-area-inset-right, 0px));
  bottom: max(74px, calc(env(safe-area-inset-bottom, 0px) + 72px));
  z-index: 2147482994;
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 1px solid rgba(7, 87, 46, .5);
  background: linear-gradient(160deg, #0b8a45 0%, #07572e 100%);
  color: #fff;
  box-shadow: 0 12px 30px rgba(9, 33, 24, .22), 0 2px 8px rgba(8, 122, 59, .18);
  text-decoration: none;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: transform .18s ease, box-shadow .18s ease;
}
.pc-gekta-floating-mark {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 25px;
  font-weight: 850;
  line-height: 1;
  letter-spacing: -.02em;
}
@media (hover: hover) {
  .pc-gekta-floating:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(9, 33, 24, .26); }
}
.pc-gekta-floating:focus-visible {
  outline: 3px solid #087a3b;
  outline-offset: 3px;
}
/* One floating surface per page. Both the current unified dock and the legacy
   public assistant/support launchers outrank this secondary product shortcut. */
body:has(.pc-public-contact-dock) .pc-gekta-floating,
body:has(.pc-public-assistant-shortcut) .pc-gekta-floating,
body:has(.p7-support-chat-button) .pc-gekta-floating,
body:has([role='dialog'][aria-modal='true']) .pc-gekta-floating,
body:has(.pc-public-assistant-panel) .pc-gekta-floating {
  display: none;
}
@media (max-width: 767px) {
  /* PlatformV7HomeMobileDensity already gives the footer 88px of bottom
     clearance. Remove the second page-level 88px reserve visible as a large
     empty slab in the iPhone evidence, while keeping the launcher unobscured. */
  .pc-v7-public-entry {
    padding-bottom: 0 !important;
  }
  .pc-v7-public-entry .pc-v6-footer nav {
    gap: 0 12px;
  }
  .pc-v7-public-entry .pc-v6-footer nav a {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    padding-inline: 2px;
  }
}
@media (max-width: 350px) {
  .pc-gekta-floating { right: max(8px, env(safe-area-inset-right, 0px)); width: 52px; height: 52px; }
  .pc-gekta-floating-mark { font-size: 23px; }
}
@media (prefers-reduced-motion: reduce) {
  .pc-gekta-floating { transition: none; }
}
@media (forced-colors: active) {
  .pc-gekta-floating { border: 2px solid ButtonText; background: Canvas; color: ButtonText; box-shadow: none; }
}
`;
