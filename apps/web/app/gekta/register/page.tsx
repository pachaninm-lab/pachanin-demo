import type { Metadata } from 'next';
import { GektaRegistrationClient } from '@/components/gekta/GektaRegistrationClient';
import type { GektaLocale } from '@/lib/gekta/content';
import { registrationConsentPresentation } from '@/lib/gekta/consent-evidence-server';
import { registrationDeliveryKey } from '@/lib/server/gekta-auth-route';

export const metadata: Metadata = {
  title: 'Регистрация в Гекте',
  description: 'Аккаунт Гекты: email, пароль и обязательная двухфакторная защита.',
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = 'force-dynamic';

type Props = Readonly<{ searchParams: Promise<{ lang?: string; confirm?: string }> }>;

export default async function GektaRegisterPage({ searchParams }: Props) {
  const { lang, confirm } = await searchParams;
  const locale: GektaLocale = lang === 'en' || lang === 'zh' ? lang : 'ru';
  const initialEmailConfirmation = confirm === 'email' || confirm === 'invalid' ? confirm : null;
  const consentPresentation = registrationConsentPresentation(locale, registrationDeliveryKey());
  return <GektaRegistrationClient initialLocale={locale} initialEmailConfirmation={initialEmailConfirmation} consentPresentation={consentPresentation} />;
}
