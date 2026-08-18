import { GektaDiscoverySections } from './GektaDiscoverySections';
import { GektaExperienceFrame } from './GektaExperienceFrame';
import { GektaHero } from './GektaHero';
import { GektaViewportAuthority } from './GektaViewportAuthority';
import type { GektaLocale } from '@/lib/gekta/content';
import { getGektaApplicationSchema, getGektaFaqSchema, safeJsonLd } from '@/lib/gekta/seo';

const mobileTouchContract = `
@media (max-width: 767px) {
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
  html:not([data-gekta-keyboard-open='true']) [data-gekta-chat-workspace='true']:not(.overflow-hidden) main > div:last-of-type:empty {
    display: none;
  }
  [data-gekta-chat-workspace='true'] header > button,
  [data-gekta-chat-workspace='true'] [data-gekta-header-new-chat='true'] {
    min-width: 44px;
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

  /* Before a conversation starts, keep the page visible and move only the
     composer into the actually visible viewport when the keyboard is open. */
  html[data-gekta-keyboard-open='true'] [data-gekta-chat-workspace='true']:not(.overflow-hidden) main > div:last-of-type {
    position: fixed;
    inset-inline: 0;
    top: calc(
      var(--gekta-visual-viewport-top, 0px) +
      var(--gekta-visual-viewport-height, 100dvh) -
      var(--gekta-composer-height, 108px)
    );
    z-index: 70;
    width: 100%;
    min-width: 0;
    padding: 0 !important;
    background: #fcfbf7;
    box-shadow: 0 -10px 32px rgba(15, 23, 42, 0.08);
  }
  html[data-gekta-keyboard-open='true'] [data-gekta-chat-workspace='true']:not(.overflow-hidden) main > div:first-of-type {
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
    <main className='min-h-screen overflow-x-clip bg-[#fcfbf7]'>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(getGektaApplicationSchema(locale)) }} />
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(getGektaFaqSchema(locale)) }} />
      <style dangerouslySetInnerHTML={{ __html: mobileTouchContract }} />
      <GektaViewportAuthority />
      <GektaExperienceFrame locale={locale} hero={<GektaHero locale={locale} />} discovery={<GektaDiscoverySections locale={locale} />} />
    </main>
  );
}
