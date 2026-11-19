import { GektaHomeLinks } from './GektaHomeLinks';
import { GektaExperienceFrame } from './GektaExperienceFrame';
import { GektaHero } from './GektaHero';
import { GektaViewportAuthority } from './GektaViewportAuthority';
import { SESSION_COOKIE } from '@/lib/auth-cookies';
import type { GektaLocale } from '@/lib/gekta/content';
import { getGektaApplicationSchema, safeJsonLd } from '@/lib/gekta/seo';

// Capture an actual edit made to the server-rendered field before React takes over.
// Browsers may restore a textarea on Back without the user editing it.
const earlyComposerInput = `(() => {
  const controller = new AbortController();
  const options = { capture: true, signal: controller.signal };
  function capture(event) {
    const field = event.target;
    if (!event.isTrusted || !(field instanceof HTMLTextAreaElement) || field.id !== 'gekta-composer-input') return;
    const marker = document.cookie.split('; ').find(part => part.startsWith('${SESSION_COOKIE}=')) || '';
    if (event.type === 'beforeinput') {
      if (field.gektaEarlyEdit?.marker !== marker && field.value !== field.defaultValue) field.value = field.defaultValue;
      field.gektaEditingMarker = marker;
    } else if (field.gektaEditingMarker === marker) {
      field.gektaEarlyEdit = { marker, text: field.value };
    }
  }
  document.addEventListener('beforeinput', capture, options);
  document.addEventListener('input', capture, options);
  document.addEventListener('gekta-composer-ready', () => controller.abort(), { once: true });
})();`;

const mobileTouchContract = `
[data-gekta-chat-workspace='true'] {
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}

[data-gekta-chat-workspace='true'] button {
  -webkit-appearance: none;
  appearance: none;
  font-family: inherit;
}

@media (max-width: 1023px) {
  /* WebKit keeps UA border/background/shadow values on otherwise unstyled
     icon buttons even after appearance:none. Reset only the two neutral
     mobile controls that intentionally inherit the surrounding surface. */
  [data-gekta-chat-workspace='true'] header > button:first-child,
  [data-gekta-chat-workspace='true'] [data-gekta-drop-target='true'] > button {
    border: 0;
    background-color: transparent;
    box-shadow: none;
  }

  [data-gekta-chat-workspace='true']:not(.overflow-hidden) {
    height: auto !important;
    min-height: var(--gekta-visual-viewport-height, 100dvh) !important;
    overflow: visible !important;
  }
  [data-gekta-chat-workspace='true']:not(.overflow-hidden) > div {
    height: auto !important;
    min-height: var(--gekta-visual-viewport-height, 100dvh) !important;
  }
  [data-gekta-chat-workspace='true']:not(.overflow-hidden) main {
    min-height: var(--gekta-visual-viewport-height, 100dvh);
  }
  [data-gekta-chat-workspace='true']:not(.overflow-hidden) main > div:first-of-type {
    min-height: 0;
    overflow: visible;
    overscroll-behavior-y: auto;
    scroll-behavior: auto !important;
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
  }
  [data-gekta-chat-workspace='true']:not(.overflow-hidden) main > div:last-of-type:empty {
    display: none;
  }
  [data-gekta-chat-workspace='true'] header > button,
  [data-gekta-chat-workspace='true'] [data-gekta-header-new-chat='true'] {
    min-width: 44px;
    min-height: 44px;
  }

  /* iOS zooms focused form controls below 16px, which changes viewport geometry
     mid-gesture and feels like a frozen/jumping interface. Keep every text-entry
     control at a stable readable size and every primary form action touch-safe. */
  [data-gekta-chat-workspace='true'] input:not([type='checkbox']):not([type='radio']):not([type='file']),
  [data-gekta-chat-workspace='true'] select,
  [data-gekta-chat-workspace='true'] textarea {
    font-size: 16px !important;
  }
  [data-gekta-chat-workspace='true'] input:not([type='checkbox']):not([type='radio']):not([type='file']),
  [data-gekta-chat-workspace='true'] select,
  [data-gekta-phone-card='true'] button {
    min-height: 44px;
  }

  /* Only an entered conversation owns the visual viewport. Discovery remains
     normal document flow so iOS browser touch scrolling never gets trapped. */
  [data-gekta-chat-workspace='true'].overflow-hidden {
    position: fixed;
    inset-inline: 0;
    top: var(--gekta-visual-viewport-top, 0px);
    z-index: 40;
    width: 100%;
    height: var(--gekta-visual-viewport-height, 100dvh) !important;
    min-height: 0 !important;
    max-height: var(--gekta-visual-viewport-height, 100dvh);
    overflow: hidden;
  }
  [data-gekta-chat-workspace='true'].overflow-hidden > div {
    height: 100% !important;
    min-height: 0 !important;
  }
  [data-gekta-chat-workspace='true'].overflow-hidden main > div:first-of-type {
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior-y: contain;
    scroll-behavior: auto !important;
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
  }

  /* Before a conversation starts, keep the page in normal flow and pin only
     the same composer node when its own textarea has focus. Search/settings
     fields may open the keyboard too, but must never pull the composer over a
     drawer or dialog. The portal parent stays unchanged through keyboard
     cycles, so focus/caret and iOS touch ownership remain stable. */
  html[data-gekta-keyboard-open='true'] [data-gekta-chat-workspace='true']:not(.overflow-hidden):has(#gekta-composer-input:focus) [data-gekta-composer-root='true'] {
    position: fixed;
    inset-inline: 0;
    top: calc(
      var(--gekta-visual-viewport-top, 0px) +
      var(--gekta-visual-viewport-height, 100dvh) -
      var(--gekta-composer-height, 108px)
    );
    z-index: 70;
    width: 100%;
    max-width: none;
    min-width: 0;
    margin: 0;
    background: var(--gekta-bg, #f7f8f3);
    box-shadow: 0 -10px 32px rgba(15, 23, 42, 0.08);
  }
  html[data-gekta-keyboard-open='true'] [data-gekta-chat-workspace='true']:not(.overflow-hidden):has(#gekta-composer-input:focus) main > div:first-of-type {
    padding-bottom: calc(var(--gekta-composer-height, 108px) + 16px) !important;
  }

  [data-gekta-chat-workspace='true'] [data-gekta-scroll-to-bottom='true'],
  [data-gekta-chat-workspace='true'] button[aria-label='Scroll to bottom'] {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    bottom: calc(var(--gekta-composer-height, 116px) + 12px) !important;
  }
  html[data-gekta-keyboard-open='true'] #gekta-composer-boundary {
    display: none !important;
  }
}
`;

export function GektaProductShell({ locale }: { locale: GektaLocale }) {
  return (
    <div className='min-h-screen overflow-x-clip'>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(getGektaApplicationSchema(locale)) }} />
      <style dangerouslySetInnerHTML={{ __html: mobileTouchContract }} />
      <script dangerouslySetInnerHTML={{ __html: earlyComposerInput }} />
      <GektaViewportAuthority />
      <GektaExperienceFrame locale={locale} hero={<GektaHero locale={locale} />} discovery={<GektaHomeLinks locale={locale} />} />
    </div>
  );
}
