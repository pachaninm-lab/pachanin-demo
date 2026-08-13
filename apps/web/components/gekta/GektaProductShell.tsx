import { GektaDiscoverySections } from './GektaDiscoverySections';
import { GektaExperienceFrame } from './GektaExperienceFrame';
import { GektaHero } from './GektaHero';
import { GektaViewportAuthority } from './GektaViewportAuthority';
import type { GektaLocale } from '@/lib/gekta/content';
import { getGektaApplicationSchema, getGektaFaqSchema, safeJsonLd } from '@/lib/gekta/seo';

const mobileTouchContract = `
@media (max-width: 767px) {
  [data-gekta-chat-workspace='true'] header > button,
  [data-gekta-chat-workspace='true'] [data-gekta-header-new-chat='true'] {
    min-width: 44px;
    min-height: 44px;
  }
  [data-gekta-chat-workspace='true'].overflow-hidden {
    height: var(--gekta-visual-viewport-height, 100svh) !important;
    min-height: 0 !important;
    max-height: var(--gekta-visual-viewport-height, 100svh);
  }
  [data-gekta-chat-workspace='true'] button[aria-label='Scroll to bottom'] {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
    bottom: calc(var(--gekta-composer-height, 116px) + 12px) !important;
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
