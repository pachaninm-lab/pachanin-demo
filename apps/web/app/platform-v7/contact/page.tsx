import type { Metadata } from 'next';
import { ContactClient } from './ContactClient';

export const metadata: Metadata = {
  title: 'Задать вопрос — подключение, банк, регион и интеграции',
  description: 'Форма обращения по платформе Прозрачная Цена: подключение организации, банковский контур, региональный запуск, роли участников и техническая интеграция.',
  alternates: { canonical: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/contact' },
  openGraph: {
    title: 'Задать вопрос — Прозрачная Цена',
    description: 'Связаться по подключению организации, банковскому контуру, региональному запуску или техническому взаимодействию с платформой.',
    url: 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/contact',
    siteName: 'Прозрачная Цена',
    locale: 'ru_RU',
    type: 'website',
  },
};

type ContactSearchParams = Record<string, string | string[] | undefined>;

function isSent(searchParams: ContactSearchParams) {
  const raw = Array.isArray(searchParams.sent) ? searchParams.sent[0] : searchParams.sent;
  return raw === '1' || raw === 'true';
}

export default async function PlatformV7ContactPage(
  props: { searchParams?: Promise<ContactSearchParams> },
) {
  const params = (await props.searchParams) ?? {};
  return <ContactClient sent={isSent(params)} />;
}
