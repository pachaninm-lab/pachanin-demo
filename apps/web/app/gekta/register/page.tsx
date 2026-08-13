import type { Metadata } from 'next';
import { GektaRegistrationClient } from '@/components/gekta/GektaRegistrationClient';
import type { GektaLocale } from '@/lib/gekta/content';

export const metadata: Metadata = {
  title: 'Регистрация в Гекте',
  description: 'Создание личного аккаунта Гекты, подтверждение email и обязательная двухфакторная защита.',
  robots: { index: false, follow: false, nocache: true },
};

type Search = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function localeOf(value: string | undefined): GektaLocale {
  return value === 'en' || value === 'zh' ? value : 'ru';
}

export default async function GektaRegisterPage({ searchParams }: { searchParams?: Promise<Search> }) {
  const params = (await searchParams) ?? {};
  const locale = localeOf(first(params.lang));
  const mode = first(params.mode) === 'login' ? 'login' : 'register';
  const confirm = first(params.confirm);
  return (
    <GektaRegistrationClient
      locale={locale}
      initialMode={mode}
      confirmEmail={confirm === 'email'}
      invalidEmailLink={confirm === 'invalid'}
    />
  );
}
