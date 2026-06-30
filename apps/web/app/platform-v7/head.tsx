const siteUrl = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const platformUrl = `${siteUrl}/platform-v7`;
const demoUrl = `${siteUrl}/platform-v7/demo`;
const contactUrl = `${siteUrl}/platform-v7/contact`;
const docsUrl = `${siteUrl}/platform-v7/docs`;

const semanticTopics = [
  'цифровой контур исполнения зерновой сделки',
  'контроль исполнения зерновой сделки после цены',
  'приёмка зерна на элеваторе',
  'качество зерна и лабораторные показатели',
  'СДИЗ ЭДО акты и документы зерновой сделки',
  'основание для оплаты зерновой сделки',
  'спор по качеству зерна и доказательства',
  'логистика зерна рейс водитель маршрут',
  'execution of grain deal',
  'OTC grain transaction control',
  'grain logistics acceptance documents',
  'grain quality dispute evidence',
  'payment basis for grain deal',
  'controlled pilot pre-integration agrifintech',
];

const serviceAreas = [
  'Фиксация цены и допусков',
  'Контроль рейса и логистики',
  'Приёмка и вес на элеваторе',
  'Показатели качества и лаборатория',
  'Документы сделки, СДИЗ, ЭДО и акты',
  'Основание для оплаты',
  'Разбор спора и пакет доказательств',
];

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'Прозрачная Цена',
      alternateName: 'Prozrachnaya Cena',
      url: siteUrl,
      description: 'Controlled pilot / pre-integration project for digital execution of grain deals.',
      knowsAbout: semanticTopics,
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'Прозрачная Цена',
      alternateName: 'Prozrachnaya Cena',
      inLanguage: 'ru-RU',
      publisher: { '@id': `${siteUrl}/#organization` },
      about: semanticTopics,
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${platformUrl}#software`,
      name: 'Прозрачная Цена',
      alternateName: 'Prozrachnaya Cena',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: platformUrl,
      inLanguage: 'ru-RU',
      description:
        'Цифровой контур исполнения зерновой сделки: цена, рейс, приёмка, качество, документы, основание для оплаты, спор и доказательства. Статус: controlled pilot / pre-integration.',
      audience: [
        { '@type': 'Audience', audienceType: 'продавец зерна' },
        { '@type': 'Audience', audienceType: 'покупатель зерна' },
        { '@type': 'Audience', audienceType: 'элеватор' },
        { '@type': 'Audience', audienceType: 'логистика зерна' },
        { '@type': 'Audience', audienceType: 'банк' },
        { '@type': 'Audience', audienceType: 'комплаенс' },
      ],
      featureList: serviceAreas,
      keywords: semanticTopics.join(', '),
      publisher: { '@id': `${siteUrl}/#organization` },
    },
    {
      '@type': 'Service',
      '@id': `${platformUrl}#execution-service`,
      name: 'Контур исполнения зерновой сделки',
      serviceType: 'Digital transaction execution control',
      areaServed: 'Russia',
      provider: { '@id': `${siteUrl}/#organization` },
      audience: [
        { '@type': 'Audience', audienceType: 'B2B agriculture transaction participants' },
        { '@type': 'Audience', audienceType: 'banking and compliance partners' },
      ],
      description:
        'Контроль исполнения сделки после согласования цены: логистика, приёмка, качество, документы, расчёт, спор и доказательства в одном процессе.',
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Execution control modules',
        itemListElement: serviceAreas.map((name) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name } })),
      },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${platformUrl}#breadcrumb`,
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Прозрачная Цена',
          item: siteUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Платформа исполнения сделки',
          item: platformUrl,
        },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': `${platformUrl}#public-entrypoints`,
      name: 'Публичные точки входа',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная платформа', url: platformUrl },
        { '@type': 'ListItem', position: 2, name: 'Демо-сделка', url: demoUrl },
        { '@type': 'ListItem', position: 3, name: 'Задать вопрос', url: contactUrl },
        { '@type': 'ListItem', position: 4, name: 'Документный контур сделки', url: docsUrl },
      ],
    },
  ],
};

export default function Head() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />;
}
