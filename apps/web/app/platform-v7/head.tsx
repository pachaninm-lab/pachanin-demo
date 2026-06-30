const siteUrl = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const platformUrl = `${siteUrl}/platform-v7`;

const semanticTopics = [
  'execution of grain deal',
  'OTC grain transaction control',
  'grain logistics acceptance documents',
  'grain quality dispute evidence',
  'payment basis for grain deal',
  'controlled pilot pre-integration agrifintech',
];

const structuredData = {
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
      about: semanticTopics,
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${platformUrl}#software`,
      name: 'Prozrachnaya Cena',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: platformUrl,
      inLanguage: 'ru-RU',
      description:
        'Digital execution contour for grain deals: logistics, acceptance, quality, documents, payment basis, dispute and evidence. Status: controlled pilot / pre-integration.',
      audience: [
        { '@type': 'Audience', audienceType: 'grain seller' },
        { '@type': 'Audience', audienceType: 'grain buyer' },
        { '@type': 'Audience', audienceType: 'grain elevator' },
        { '@type': 'Audience', audienceType: 'grain logistics operator' },
        { '@type': 'Audience', audienceType: 'banking partner' },
      ],
      keywords: semanticTopics.join(', '),
      publisher: { '@id': `${siteUrl}/#organization` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${platformUrl}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Prozrachnaya Cena',
          item: siteUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Platform V7',
          item: platformUrl,
        },
      ],
    },
  ],
};

export default function Head() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />;
}
