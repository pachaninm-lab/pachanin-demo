import type { Metadata } from 'next';
import { GektaChatApp } from '@/components/gekta/GektaChatApp';

export const metadata: Metadata = {
  title: 'Гекта — аграрный интеллект для сельского хозяйства и агробизнеса',
  description: 'Гекта — отдельный AI-интерфейс для сельского хозяйства и агробизнеса: растениеводство, животноводство, техника, хранение, экономика, документы и практические задачи на естественном языке.',
  applicationName: 'Гекта',
  keywords: [
    'Гекта',
    'Gekta',
    'аграрный интеллект',
    'ИИ для сельского хозяйства',
    'ИИ для агробизнеса',
    'агрономия',
    'растениеводство',
    'животноводство',
    'сельхозтехника',
    'фермер',
    'агробизнес',
  ],
  alternates: {
    canonical: '/gekta',
    languages: {
      ru: '/gekta?lang=ru',
      en: '/gekta?lang=en',
      zh: '/gekta?lang=zh',
    },
  },
  openGraph: {
    type: 'website',
    title: 'Гекта — аграрный интеллект',
    description: 'Один AI-интерфейс для задач сельского хозяйства и агробизнеса — от огорода и техники до агрономии и экономики хозяйства.',
    url: '/gekta',
    siteName: 'Гекта',
    locale: 'ru_RU',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Гекта — аграрный интеллект',
    description: 'Спроси Гекту о сельском хозяйстве, агрономии, технике, животноводстве или агробизнесе.',
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

const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Гекта',
  alternateName: ['Gekta', 'ГЕКТА'],
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: ['ru', 'en', 'zh'],
  description: 'Аграрный AI-интерфейс для сельского хозяйства и агробизнеса.',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'RUB',
    availability: 'https://schema.org/OnlineOnly',
  },
} as const;

export default function GektaPage() {
  return (
    <>
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <GektaChatApp />
    </>
  );
}
