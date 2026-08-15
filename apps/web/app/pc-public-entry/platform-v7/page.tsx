import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import './home-approved-contact-dock.css';
import PlatformV7RootPage from '@/app/platform-v7/page';

type PublicLocale = 'ru' | 'en' | 'zh';

type PublicMetadataCopy = Readonly<{
  title: string;
  description: string;
  openGraphTitle: string;
  openGraphDescription: string;
  twitterTitle: string;
  twitterDescription: string;
  openGraphLocale: string;
}>;

const METADATA_COPY: Record<PublicLocale, PublicMetadataCopy> = {
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
    description: 'A unified digital transaction layer for terms, access, trading, logistics, quality, documents, government systems, financing, money, disputes, evidence and closing.',
    openGraphTitle: 'Transparent Price — crop-trade execution infrastructure',
    openGraphDescription: 'One transaction connects the commodity, participants, logistics, quality, documents and money.',
    twitterTitle: 'Transparent Price — crop-trade execution infrastructure',
    twitterDescription: 'Digital infrastructure for crop-trade execution.',
    openGraphLocale: 'en_US',
  },
  zh: {
    title: '透明价格 — 种植业交易执行数字基础设施',
    description: '统一数字交易执行层，覆盖条件、准入、交易、物流、质量、文件、政府系统、融资、资金、争议、证据与结算关闭。',
    openGraphTitle: '透明价格 — 种植业交易执行基础设施',
    openGraphDescription: '一笔交易连接商品、参与方、物流、质量、文件与资金。',
    twitterTitle: '透明价格 — 种植业交易执行基础设施',
    twitterDescription: '种植业交易执行数字基础设施。',
    openGraphLocale: 'zh_CN',
  },
};

function normalizeLocale(locale: string): PublicLocale {
  return locale === 'en' || locale === 'zh' ? locale : 'ru';
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = normalizeLocale(await getLocale());
  const copy = METADATA_COPY[locale];
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
      siteName: 'Процент-Агро',
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
