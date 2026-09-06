import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { ContactClient } from './ContactClient';

type Locale = 'ru' | 'en' | 'zh';
type ContactSearchParams = Record<string, string | string[] | undefined>;

const META: Record<Locale, { title: string; description: string; locale: string }> = {
  ru: {
    title: 'Контакты — Прозрачная Цена',
    description: 'Официальный канал обращения по платформе «Прозрачная Цена»: вопросы о платформе, партнёрстве, региональном взаимодействии и техническом подключении.',
    locale: 'ru_RU',
  },
  en: {
    title: 'Contact — Transparent Price',
    description: 'Official contact channel for Transparent Price: platform questions, partnerships, regional cooperation and technical connection.',
    locale: 'en_US',
  },
  zh: {
    title: '联系 — 透明价格',
    description: '“透明价格”官方联系渠道：平台问题、合作、区域协作与技术接入。',
    locale: 'zh_CN',
  },
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeLocale(value: string | undefined): Locale {
  if (value?.startsWith('en')) return 'en';
  if (value?.startsWith('zh')) return 'zh';
  return 'ru';
}

function localeOf(params: ContactSearchParams, fallbackLocale: string): Locale {
  const lang = first(params.lang);
  if (lang === 'en' || lang === 'zh' || lang === 'ru') return lang;
  return normalizeLocale(fallbackLocale);
}

function isSent(searchParams: ContactSearchParams) {
  const raw = first(searchParams.sent);
  return raw === '1' || raw === 'true';
}

function hasDeliveryError(searchParams: ContactSearchParams) {
  return Boolean(first(searchParams.error));
}

export async function generateMetadata(
  props: { searchParams?: Promise<ContactSearchParams> },
): Promise<Metadata> {
  const params = (await props.searchParams) ?? {};
  const locale = localeOf(params, await getLocale());
  const meta = META[locale];
  const canonical = 'https://xn----8sbjf4befbjgs9b.xn--p1ai/platform-v7/contact';
  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical,
      languages: {
        ru: `${canonical}?lang=ru`,
        en: `${canonical}?lang=en`,
        zh: `${canonical}?lang=zh`,
      },
    },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url: `${canonical}?lang=${locale}`,
      siteName: 'Прозрачная Цена',
      locale: meta.locale,
      type: 'website',
    },
  };
}

export default async function PlatformV7ContactPage(
  props: { searchParams?: Promise<ContactSearchParams> },
) {
  const params = (await props.searchParams) ?? {};
  const locale = localeOf(params, await getLocale());
  return <ContactClient sent={isSent(params)} failed={hasDeliveryError(params)} locale={locale} />;
}
