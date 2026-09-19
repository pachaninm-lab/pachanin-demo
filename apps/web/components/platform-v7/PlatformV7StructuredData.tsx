import { PUBLIC_BRAND_ORIGIN } from '@/lib/platform-v7/public-brand-domain';

const siteUrl = PUBLIC_BRAND_ORIGIN;
const platformUrl = `${siteUrl}/platform-v7`;

const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'Prozrachnaya Cena',
      url: siteUrl,
      description: 'Controlled pilot pre-integration project for digital execution of grain deals.',
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'Prozrachnaya Cena',
      inLanguage: 'ru-RU',
      publisher: { '@id': `${siteUrl}/#organization` },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${platformUrl}#software`,
      name: 'Prozrachnaya Cena',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: platformUrl,
      inLanguage: 'ru-RU',
      description: 'Digital execution contour for grain deals: logistics, acceptance, quality, documents, payment basis, dispute and evidence.',
      publisher: { '@id': `${siteUrl}/#organization` },
    },
  ],
};

export function PlatformV7StructuredData() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
