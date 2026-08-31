import type { Metadata } from 'next';
import { GEKTA_PATHS, getGektaCopy, type GektaLocale, type GektaTopic } from './content';

export const GEKTA_ORIGIN = 'https://xn----8sbjf4befbjgs9b.xn--p1ai';

const META: Record<GektaLocale, { title: string; description: string; ogLocale: string }> = {
  ru: {
    title: 'Гекта — аграрный ИИ для сельского хозяйства и агробизнеса',
    description: 'Гекта — аграрный ИИ для фермеров и агробизнеса: агрономия, растениеводство, животноводство, техника, хранение, экономика, документы и расчёты.',
    ogLocale: 'ru_RU',
  },
  en: {
    title: 'Gekta — agricultural AI for farming and agribusiness',
    description: 'Gekta is agricultural AI for farmers and agribusiness: agronomy, crops, livestock, machinery, storage, economics, documents and calculations.',
    ogLocale: 'en_GB',
  },
  zh: {
    title: 'Gekta — 面向农业生产与农业经营的农业 AI',
    description: 'Gekta 是面向农户与农业企业的农业 AI：种植、农艺、畜牧、农业机械、仓储、经营经济、文件与计算。',
    ogLocale: 'zh_CN',
  },
};

export function getGektaMetadata(locale: GektaLocale): Metadata {
  const meta = META[locale];
  const path = GEKTA_PATHS[locale];
  return {
    title: { absolute: meta.title },
    description: meta.description,
    keywords: [],
    applicationName: locale === 'ru' ? 'Гекта' : 'Gekta',
    alternates: {
      canonical: path,
      languages: {
        'ru-RU': '/gekta',
        en: '/gekta/en',
        'zh-CN': '/gekta/zh',
        'x-default': '/gekta',
      },
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large' },
    },
    openGraph: {
      type: 'website',
      siteName: 'Прозрачная Цена',
      title: meta.title,
      description: meta.description,
      url: path,
      locale: meta.ogLocale,
      images: [{ url: `${path}/opengraph-image`, width: 1200, height: 630, alt: meta.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.title,
      description: meta.description,
      images: [`${path}/opengraph-image`],
    },
    manifest: '/gekta/manifest.webmanifest',
  };
}

export function getGektaApplicationSchema(locale: GektaLocale) {
  const copy = getGektaCopy(locale);
  const path = GEKTA_PATHS[locale];
  return {
    '@context': 'https://schema.org',
    '@type': ['WebApplication', 'SoftwareApplication'],
    name: locale === 'ru' ? 'Гекта' : 'Gekta',
    alternateName: 'Gekta',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: `${GEKTA_ORIGIN}${path}`,
    inLanguage: copy.htmlLang,
    description: META[locale].description,
    creator: {
      '@type': 'Organization',
      name: 'Прозрачная Цена',
      url: `${GEKTA_ORIGIN}/platform-v7`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Прозрачная Цена',
      url: `${GEKTA_ORIGIN}/platform-v7`,
    },
  } as const;
}

/**
 * FAQPage is only emitted because the same questions and answers are rendered
 * for the reader on the page itself. Nothing here is generated from data the
 * product does not have.
 */
export function getGektaFaqSchema(locale: GektaLocale) {
  const copy = getGektaCopy(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: copy.htmlLang,
    url: `${GEKTA_ORIGIN}${GEKTA_PATHS[locale]}`,
    mainEntity: copy.faq.map(([question, answer]) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: { '@type': 'Answer', text: answer },
    })),
  } as const;
}

export function getGektaTopicMetadata(topic: GektaTopic): Metadata {
  const path = `/gekta/${topic.slug}`;
  return {
    title: topic.title,
    description: topic.description,
    keywords: [],
    alternates: { canonical: path },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'article',
      siteName: 'Прозрачная Цена',
      title: topic.title,
      description: topic.description,
      url: path,
      locale: 'ru_RU',
      images: [{ url: '/gekta/opengraph-image', width: 1200, height: 630, alt: topic.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: topic.title,
      description: topic.description,
      images: ['/gekta/opengraph-image'],
    },
  };
}

export function getGektaTopicSchema(topic: GektaTopic) {
  const url = `${GEKTA_ORIGIN}/gekta/${topic.slug}`;
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: topic.title,
      description: topic.description,
      url,
      inLanguage: 'ru',
      isPartOf: { '@type': 'WebSite', name: 'Прозрачная Цена', url: GEKTA_ORIGIN },
      about: {
        '@type': 'SoftwareApplication',
        name: 'Гекта',
        alternateName: 'Gekta',
        applicationCategory: 'BusinessApplication',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Гекта', item: `${GEKTA_ORIGIN}/gekta` },
        { '@type': 'ListItem', position: 2, name: topic.h1, item: url },
      ],
    },
  ] as const;
}

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</gu, '\\u003c');
}
