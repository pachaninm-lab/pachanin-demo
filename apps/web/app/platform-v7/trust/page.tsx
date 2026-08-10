import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { Fragment } from 'react';
import BaseTrustCenterPage from '../../trust/page';

type Locale = 'ru' | 'en' | 'zh';

const METADATA: Record<Locale, Readonly<{ title: string; description: string }>> = {
  ru: {
    title: 'Trust Center — безопасность, данные и ИИ',
    description: 'Публичные правила полномочий, доказательств, обработки данных, доступности и использования Гекты в платформе Прозрачная Цена.',
  },
  en: {
    title: 'Trust Center — security, data and AI',
    description: 'Public authority, evidence, data-processing, availability and Gekta boundaries for the Transparent Price platform.',
  },
  zh: {
    title: '信任中心 — 安全、数据与 AI',
    description: '透明价格平台公开的权限、证据、数据处理、可用性与 Gekta 边界。',
  },
};

function localeOf(value: string): Locale {
  if (value.startsWith('en')) return 'en';
  if (value.startsWith('zh')) return 'zh';
  return 'ru';
}

export default async function PlatformV7TrustPage() {
  const page = await BaseTrustCenterPage();
  return (
    <Fragment>
      <style>{'.p7-ai-trigger,.p7-support-chat-button{display:none!important}'}</style>
      {page}
    </Fragment>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = localeOf(await getLocale());
  const copy = METADATA[locale];
  return {
    title: copy.title,
    description: copy.description,
    alternates: {
      canonical: '/platform-v7/trust',
      languages: {
        ru: '/platform-v7/trust?lang=ru',
        en: '/platform-v7/trust?lang=en',
        zh: '/platform-v7/trust?lang=zh',
      },
    },
    robots: { index: true, follow: true },
  };
}
