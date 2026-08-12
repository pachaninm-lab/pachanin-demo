import { GektaDiscoverySections } from './GektaDiscoverySections';
import { GektaExperienceFrame } from './GektaExperienceFrame';
import { GektaHero } from './GektaHero';
import type { GektaLocale } from '@/lib/gekta/content';
import { getGektaApplicationSchema, safeJsonLd } from '@/lib/gekta/seo';

const mobileTouchContract = `
@media (max-width: 767px) {
  [data-gekta-chat-workspace='true'] header > button {
    min-width: 44px;
    min-height: 44px;
  }
  [data-gekta-chat-workspace='true'] button[aria-label='Scroll to bottom'] {
    width: 44px;
    height: 44px;
    min-width: 44px;
    min-height: 44px;
  }
}
`;

export function GektaProductShell({ locale }: { locale: GektaLocale }) {
  return (
    <main className='min-h-screen bg-[#fcfbf7]'>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(getGektaApplicationSchema(locale)) }} />
      <style dangerouslySetInnerHTML={{ __html: mobileTouchContract }} />
      <GektaExperienceFrame locale={locale} hero={<GektaHero locale={locale} />} discovery={<GektaDiscoverySections locale={locale} />} />
    </main>
  );
}
