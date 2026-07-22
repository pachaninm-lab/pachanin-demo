const siteUrl = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const platformUrl = `${siteUrl}/platform-v7`;
const dealFlowUrl = `${siteUrl}/platform-v7/deal-flow`;
const contactUrl = `${siteUrl}/platform-v7/contact`;
const docsUrl = `${siteUrl}/platform-v7/docs`;
const aboutUrl = `${siteUrl}/platform-v7/about`;
const pageTitle = 'Прозрачная Цена / Процент Агро — контур исполнения зерновой сделки';
const pageDescription = 'Прозрачная Цена на домене Процент-Агро.рф — цифровой контур исполнения зерновой сделки: рейс, приёмка, документы, расчёт, спор и доказательства. Внешние интеграции подключаются по договору и ключам доступа.';

const brandNames = ['Прозрачная Цена', 'Процент Агро', 'Процент-Агро.рф', 'процент агро сайт', 'Prozrachnaya Cena', 'Percent Agro'];

const semanticTopics = [
  'Процент Агро',
  'Процент-Агро.рф',
  'процент агро сайт',
  'процент агро платформа',
  'Прозрачная Цена на домене Процент-Агро.рф',
  'цифровой контур исполнения зерновой сделки',
  'боевой контур исполнения зерновой сделки',
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
  'agri transaction execution platform',
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
      alternateName: brandNames,
      url: siteUrl,
      description: 'Прозрачная Цена на домене Процент-Агро.рф: цифровой контур исполнения зерновых сделок. Внешние интеграции подключаются по договору и ключам доступа.',
      knowsAbout: semanticTopics,
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'Прозрачная Цена',
      alternateName: brandNames,
      inLanguage: 'ru-RU',
      publisher: { '@id': `${siteUrl}/#organization` },
      about: semanticTopics,
      keywords: semanticTopics.join(', '),
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${platformUrl}#software`,
      name: 'Прозрачная Цена',
      alternateName: brandNames,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: platformUrl,
      inLanguage: 'ru-RU',
      description:
        'Прозрачная Цена на домене Процент-Агро.рф — цифровой контур исполнения зерновой сделки: цена, рейс, приёмка, качество, документы, основание для оплаты, спор и доказательства. Внешние интеграции ФГИС, ЭДО и банковского контура подключаются по договору и ключам доступа.',
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
      alternateName: 'Процент Агро — контур исполнения зерновой сделки',
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
          name: 'Прозрачная Цена / Процент Агро',
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
        { '@type': 'ListItem', position: 1, name: 'Главная платформа Процент-Агро.рф', url: platformUrl },
        { '@type': 'ListItem', position: 2, name: 'Контур сделки', url: dealFlowUrl },
        { '@type': 'ListItem', position: 3, name: 'Задать вопрос', url: contactUrl },
        { '@type': 'ListItem', position: 4, name: 'Документный контур сделки', url: docsUrl },
        { '@type': 'ListItem', position: 5, name: 'О проекте и контуре исполнения', url: aboutUrl },
      ],
    },
  ],
};

export default function Head() {
  return (
    <>
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta name="keywords" content={semanticTopics.join(', ')} />
      <meta name="google" content="notranslate" />
      <meta httpEquiv="Content-Language" content="ru-RU" />
      <link rel="canonical" href={platformUrl} />
      <link rel="stylesheet" href="/platform-v7-density-fix.css" />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={platformUrl} />
      <meta property="og:site_name" content="Прозрачная Цена / Процент Агро" />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}
