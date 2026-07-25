const siteUrl = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';
const platformUrl = `${siteUrl}/platform-v7`;
const dealFlowUrl = `${siteUrl}/platform-v7/deal-flow`;
const taiUrl = `${siteUrl}/platform-v7/ai-in-action`;
const contactUrl = `${siteUrl}/platform-v7/contact`;
const docsUrl = `${siteUrl}/platform-v7/docs`;
const aboutUrl = `${siteUrl}/platform-v7/about`;
const pageTitle = 'Прозрачная Цена — контроль исполнения агросделки от цены до расчёта';
const pageDescription = 'Товар, логистика, качество, документы, деньги, спор и доказательства связаны в одной Сделке. TAI объясняет блокеры, риски и следующий шаг.';

const brandNames = ['Прозрачная Цена', 'Процент Агро', 'Процент-Агро.рф', 'Prozrachnaya Cena', 'Transparent Price', 'Percent Agro'];

const semanticTopics = [
  'Прозрачная Цена',
  'Процент Агро',
  'Процент-Агро.рф',
  'цифровая инфраструктура агросделки',
  'исполнение внебиржевой сделки в АПК',
  'контроль сделки после согласования цены',
  'аукцион сельскохозяйственной продукции',
  'логистика и приёмка сельхозпродукции',
  'качество и лабораторные показатели',
  'документы СДИЗ ЭДО КЭП ГИС ЭПД',
  'основание для расчёта по агросделке',
  'спор и доказательства по качеству',
  'TAI Transparent Agro Intelligence',
  'операционный интеллект агросделки',
  'agricultural Deal execution platform',
  'OTC agricultural transaction control',
  'agri logistics quality documents settlement',
];

const serviceAreas = [
  'Цена, допуски и аукцион',
  'Сделка и ролевое исполнение',
  'Логистика, приёмка и хранение',
  'Качество, лаборатория и перерасчёт',
  'Документы, СДИЗ, ЭДО, КЭП и транспортный контур',
  'Резервирование, выплата и сверка',
  'Спор, доказательства и закрытие',
  'TAI — объяснение блокеров, рисков и следующего действия',
];

const platformDescription = 'Единая цифровая инфраструктура исполнения агросделки: цена, участники, логистика, приёмка, качество, документы, деньги, спор, доказательства и закрытие связаны в одном объекте Сделки. Внешние системы подключаются через управляемые API-адаптеры с отдельно определяемыми правами и режимом обмена.';

const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'Прозрачная Цена',
      alternateName: brandNames,
      url: siteUrl,
      description: platformDescription,
      knowsAbout: semanticTopics,
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'Прозрачная Цена',
      alternateName: brandNames,
      inLanguage: ['ru-RU', 'en', 'zh-CN'],
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
      inLanguage: ['ru-RU', 'en', 'zh-CN'],
      description: platformDescription,
      audience: [
        { '@type': 'Audience', audienceType: 'производители и продавцы сельскохозяйственной продукции' },
        { '@type': 'Audience', audienceType: 'покупатели и переработчики' },
        { '@type': 'Audience', audienceType: 'логистические организации и водители' },
        { '@type': 'Audience', audienceType: 'элеваторы и операторы хранения' },
        { '@type': 'Audience', audienceType: 'лаборатории и сюрвейеры' },
        { '@type': 'Audience', audienceType: 'банки, комплаенс и арбитраж' },
      ],
      featureList: serviceAreas,
      keywords: semanticTopics.join(', '),
      publisher: { '@id': `${siteUrl}/#organization` },
    },
    {
      '@type': 'Service',
      '@id': `${platformUrl}#execution-service`,
      name: 'Единый контур исполнения агросделки',
      alternateName: 'Прозрачная Цена — инфраструктура исполнения Сделки',
      serviceType: 'Digital agricultural transaction execution control',
      areaServed: 'Russia',
      provider: { '@id': `${siteUrl}/#organization` },
      audience: [
        { '@type': 'Audience', audienceType: 'B2B agricultural transaction participants' },
        { '@type': 'Audience', audienceType: 'banking, compliance and integration partners' },
      ],
      description: 'Контроль исполнения после согласования условий: логистика, приёмка, качество, документы, расчёт, спор и доказательства в одном процессе.',
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Deal execution capabilities',
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
          name: 'Платформа исполнения агросделки',
          item: platformUrl,
        },
      ],
    },
    {
      '@type': 'ItemList',
      '@id': `${platformUrl}#public-entrypoints`,
      name: 'Публичные точки входа',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Главная платформы', url: platformUrl },
        { '@type': 'ListItem', position: 2, name: 'Сделка в работе', url: dealFlowUrl },
        { '@type': 'ListItem', position: 3, name: 'TAI в действии', url: taiUrl },
        { '@type': 'ListItem', position: 4, name: 'Документный контур', url: docsUrl },
        { '@type': 'ListItem', position: 5, name: 'Контакты', url: contactUrl },
        { '@type': 'ListItem', position: 6, name: 'О платформе', url: aboutUrl },
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
      <link rel="alternate" hrefLang="ru" href={`${platformUrl}?lang=ru`} />
      <link rel="alternate" hrefLang="en" href={`${platformUrl}?lang=en`} />
      <link rel="alternate" hrefLang="zh" href={`${platformUrl}?lang=zh`} />
      <link rel="alternate" hrefLang="x-default" href={platformUrl} />
      <link rel="stylesheet" href="/platform-v7-density-fix.css" />
      <meta property="og:type" content="website" />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={platformUrl} />
      <meta property="og:site_name" content="Прозрачная Цена / Процент Агро" />
      <meta property="og:locale" content="ru_RU" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
    </>
  );
}
