import type { Metadata } from 'next';
import './home-approved-contact-dock.css';
import PlatformV7RootPage from '@/app/platform-v7/page';

type PublicLanguage = 'ru' | 'en' | 'zh';

type PublicEntryPlatformV7PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const PUBLIC_METADATA: Record<
  PublicLanguage,
  {
    title: string;
    description: string;
    openGraphTitle: string;
    openGraphDescription: string;
    twitterDescription: string;
    locale: string;
  }
> = {
  ru: {
    title: 'Платформа управления агросделками — Прозрачная Цена',
    description:
      'Платформа управления агросделками в растениеводстве: торги, договор, поставка, качество, документы, TAI, готовность расчёта, споры и интеграции в одной Сделке.',
    openGraphTitle: 'Прозрачная Цена — платформа управления агросделками',
    openGraphDescription:
      'Одна Сделка связывает торги, договор, поставку, качество, документы, готовность расчёта, споры и интеграции.',
    twitterDescription: 'Управление агросделкой от цены до расчёта в одном проверяемом контуре.',
    locale: 'ru_RU',
  },
  en: {
    title: 'Agricultural Deal Management Platform — Transparent Price',
    description:
      'Crop-trade deal management platform: bidding, contract, delivery, quality, documents, TAI, settlement readiness, disputes and integrations in one Deal.',
    openGraphTitle: 'Transparent Price — Agricultural Deal Management Platform',
    openGraphDescription:
      'One Deal connects bidding, contract, delivery, quality, documents, settlement readiness, disputes and integrations.',
    twitterDescription: 'Manage a crop-trade Deal from price to settlement in one verifiable workflow.',
    locale: 'en_US',
  },
  zh: {
    title: '农业交易管理平台 — 透明价格',
    description:
      '面向种植业的农业交易管理平台：竞价、合同、交付、质量、文件、TAI、结算准备度、争议与集成统一在一笔交易中。',
    openGraphTitle: '透明价格 — 农业交易管理平台',
    openGraphDescription: '一笔交易统一连接竞价、合同、交付、质量、文件、结算准备度、争议与集成。',
    twitterDescription: '在一个可验证流程中管理从价格到结算的农业交易。',
    locale: 'zh_CN',
  },
};

function normalizeLanguage(value: string | string[] | undefined): PublicLanguage {
  const language = Array.isArray(value) ? value[0] : value;
  return language === 'en' || language === 'zh' ? language : 'ru';
}

export async function generateMetadata({ searchParams }: PublicEntryPlatformV7PageProps): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};
  const language = normalizeLanguage(params.lang);
  const copy = PUBLIC_METADATA[language];
  const canonical = `/platform-v7?lang=${language}`;

  return {
    title: { absolute: copy.title },
    description: copy.description,
    alternates: {
      canonical,
      languages: {
        ru: '/platform-v7?lang=ru',
        en: '/platform-v7?lang=en',
        zh: '/platform-v7?lang=zh',
        'x-default': '/platform-v7?lang=ru',
      },
    },
    openGraph: {
      type: 'website',
      title: copy.openGraphTitle,
      description: copy.openGraphDescription,
      url: canonical,
      siteName: 'Прозрачная Цена',
      locale: copy.locale,
    },
    twitter: {
      card: 'summary_large_image',
      title: copy.openGraphTitle,
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
