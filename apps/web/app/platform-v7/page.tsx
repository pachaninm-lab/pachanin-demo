import '@/styles/platform-v7-public-header.css';
import '@/styles/platform-v7-public-mobile-safe-area.css';
import '@/styles/platform-v7-public-typography.css';
import '@/styles/platform-v7-i18n-cjk.css';
import '@/styles/platform-v7-strategic-home-v3.css';
import '@/styles/platform-v7-hero-infrastructure-message.css';
import type { Metadata } from 'next';
import { PlatformV7StrategicHome } from '@/components/platform-v7/PlatformV7StrategicHome';

export const metadata: Metadata = {
  title: 'Прозрачная Цена — контроль исполнения агросделки от цены до расчёта',
  description: 'Единый цифровой контур Сделки: товар, участники, торги, логистика, приёмка, качество, документы, деньги, спор, доказательства и закрытие.',
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
    title: 'Прозрачная Цена — контроль исполнения Сделки',
    description: 'Одна Сделка связывает товар, участников, логистику, качество, документы и деньги до расчёта и закрытия.',
    url: '/platform-v7',
    siteName: 'Прозрачная Цена',
    locale: 'ru_RU',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Прозрачная Цена — контроль исполнения Сделки',
    description: 'Единая цифровая инфраструктура агросделки от цены до расчёта и закрытия.',
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

export default function PlatformV7RootPage() {
  return <PlatformV7StrategicHome />;
}
