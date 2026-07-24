import type { Metadata } from 'next';
import './home-approved-contact-dock.css';
import PlatformV7RootPage from '@/app/platform-v7/page';

export const metadata: Metadata = {
  title: 'Прозрачная Цена — цифровая инфраструктура исполнения сделок в растениеводстве',
  description: 'Единый цифровой контур Сделки: условия, допуск, торги, логистика, качество, документы, государственные системы, финансирование, деньги, споры, доказательства и закрытие.',
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
    title: 'Прозрачная Цена — инфраструктура исполнения Сделки',
    description: 'Одна Сделка связывает товар, участников, логистику, качество, документы и деньги.',
    url: '/platform-v7',
    siteName: 'Прозрачная Цена',
    locale: 'ru_RU',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Прозрачная Цена — инфраструктура исполнения Сделки',
    description: 'Цифровой контур исполнения сделок в растениеводстве.',
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

export default function PublicEntryPlatformV7Page() {
  return (
    <div data-contact-dock-visual='approved'>
      <PlatformV7RootPage />
    </div>
  );
}
