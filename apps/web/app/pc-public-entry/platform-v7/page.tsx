import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import './home-approved-contact-dock.css';
import PlatformV7RootPage from '@/app/platform-v7/page';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isAppLocale,
  type AppLocale,
} from '@/i18n/locale';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type PublicMetadataCopy = {
  title: string;
  description: string;
  openGraphTitle: string;
  openGraphDescription: string;
  twitterTitle: string;
  twitterDescription: string;
  openGraphLocale: string;
};

const PUBLIC_METADATA_COPY: Record<AppLocale, PublicMetadataCopy> = {
  ru: {
    title: 'Прозрачная Цена — цифровая инфраструктура исполнения сделок в растениеводстве',
    description: 'Единый цифровой контур Сделки: условия, допуск, торги, логистика, качество, документы, государственные системы, финансирование, деньги, споры, доказательства и закрытие.',
    openGraphTitle: 'Прозрачная Цена — инфраструктура исполнения Сделки',
    openGraphDescription: 'Одна Сделка связывает товар, участников, логистику, качество, документы и деньги.',
    twitterTitle: 'Прозрачная Цена — инфраструктура исполнения Сделки',
    twitterDescription: 'Цифровой контур исполнения сделок в растениеводстве.',
    openGraphLocale: 'ru_RU',
  },
  en: {
    title: 'Transparent Price — digital infrastructure for crop-trade execution',
    description: 'A unified digital transaction flow for terms, admission, bidding, logistics, quality, documents, government systems, financing, money, disputes, evidence and closing.',
    openGraphTitle: 'Transparent Price — transaction execution infrastructure',
    openGraphDescription: 'One transaction connects the commodity, participants, logistics, quality, documents and money.',
    twitterTitle: 'Transparent Price — transaction execution infrastructure',
    twitterDescription: 'Digital infrastructure for crop-trade execution.',
    openGraphLocale: 'en_US',
  },
  zh: {
    title: '透明价格 — 种植业交易执行数字基础设施',
    description: '统一的交易执行数字流程：交易条件、准入、竞价、物流、质量、文件、政府系统、融资、资金、争议、证据与关闭。',
    openGraphTitle: '透明价格 — 交易执行基础设施',
    openGraphDescription: '一笔交易连接商品、参与方、物流、质量、文件和资金。',
    twitterTitle: '透明价格 — 交易执行基础设施',
    twitterDescription: '种植业交易执行数字基础设施。',
    openGraphLocale: 'zh_CN',
  },
};

function firstSearchParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function resolveMetadataLocale(searchParams: SearchParams): Promise<AppLocale> {
  // Middleware resolves the original public URL before Next.js applies the
  // internal /platform-v7 -> /pc-public-entry/platform-v7 rewrite. The
  // x-pc-locale request header therefore preserves explicit ?lang= authority
  // even when the rewritten destination does not receive reliable searchParams.
  const requestLocale = (await headers()).get('x-pc-locale');
  if (isAppLocale(requestLocale)) return requestLocale;

  const params = await searchParams;
  const queryLocale = firstSearchParam(params.lang);
  if (isAppLocale(queryLocale)) return queryLocale;

  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isAppLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const locale = await resolveMetadataLocale(searchParams);
  const copy = PUBLIC_METADATA_COPY[locale];

  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: '/platform-v7',
      languages: {
        ru: '/platform-v7?lang=ru',
        en: '/platform-v7?lang=en',
        zh: '/platform-v7?lang=zh',
      },
    },
    openGraph: {
      type: 'website',
      title: copy.openGraphTitle,
      description: copy.openGraphDescription,
      url: '/platform-v7',
      siteName: 'Прозрачная Цена',
      locale: copy.openGraphLocale,
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.twitterTitle,
      description: copy.twitterDescription,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  };
}

export default function PublicEntryPlatformV7Page() {
  return (
    <div data-contact-dock-visual='approved'>
      <PlatformV7RootPage />
    </div>
  );
}
