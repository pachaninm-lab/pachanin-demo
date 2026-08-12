import { GektaDiscoverySections } from './GektaDiscoverySections';
import { GektaExperienceFrame } from './GektaExperienceFrame';
import { GektaHero } from './GektaHero';
import type { GektaLocale } from '@/lib/gekta/content';
import { getGektaApplicationSchema, safeJsonLd } from '@/lib/gekta/seo';

export function GektaProductShell({ locale }: { locale: GektaLocale }) {
  return (
    <main className='min-h-screen bg-[#fcfbf7]'>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: safeJsonLd(getGektaApplicationSchema(locale)) }} />
      <GektaExperienceFrame locale={locale} hero={<GektaHero locale={locale} />} discovery={<GektaDiscoverySections locale={locale} />} />
    </main>
  );
}
