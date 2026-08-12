'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { GektaLocale } from '@/lib/gekta/content';
import type { GektaEntitlementSnapshot } from '@/lib/gekta/entitlement';

const UI = {
  ru: {
    title: 'Бесплатные ответы закончились',
    withRegistration: 'Зарегистрируйтесь, чтобы продолжить разговор, сохранять историю и получить пробный доступ.',
    withoutRegistration: 'Регистрация в Гекте ещё подключается. Материалы продукта и поддержка доступны по ссылкам ниже.',
    cta: 'Зарегистрироваться',
    support: 'Написать в поддержку',
    product: 'О возможностях Гекты',
    note: 'История, сохранённая в этом браузере, остаётся доступной.',
    remaining: (left: number, limit: number) => `Бесплатно — ${left} из ${limit} ответов Гекты`,
  },
  en: {
    title: 'Your free answers are used up',
    withRegistration: 'Register to continue the conversation, keep your history and start the trial.',
    withoutRegistration: 'Gekta registration is still being connected. Product material and support are linked below.',
    cta: 'Register',
    support: 'Contact support',
    product: 'What Gekta can do',
    note: 'History saved in this browser stays available.',
    remaining: (left: number, limit: number) => `Free — ${left} of ${limit} Gekta answers left`,
  },
  zh: {
    title: '免费回答已用完',
    withRegistration: '注册后可以继续对话、保存历史记录并开始试用。',
    withoutRegistration: 'Gekta 注册功能仍在接入中。可通过下方链接查看产品资料与支持。',
    cta: '注册',
    support: '联系支持',
    product: 'Gekta 能做什么',
    note: '保存在此浏览器中的历史记录仍然可用。',
    remaining: (left: number, limit: number) => `免费 — 还剩 ${left} / ${limit} 次 Gekta 回答`,
  },
} as const;

/** Small always-on counter while free answers remain. */
export function GektaRemainingBadge({ locale, entitlement }: { locale: GektaLocale; entitlement: GektaEntitlementSnapshot | null }) {
  if (!entitlement || entitlement.remaining === null || entitlement.limit === null || !entitlement.canAsk) return null;
  return (
    <span className='hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 sm:inline' data-gekta-remaining='true'>
      {UI[locale].remaining(entitlement.remaining, entitlement.limit)}
    </span>
  );
}

/**
 * Shown in place of the composer once the server refuses further answers. The
 * decision it renders is the server's; this component never computes access.
 *
 * The registration action appears only when a registration entry point is
 * actually configured for Gekta, so the gate never offers a button that leads
 * nowhere useful.
 */
export function GektaAccessGate({ locale, registrationUrl }: { locale: GektaLocale; registrationUrl: string | null }) {
  const ui = UI[locale];
  return (
    <div className='mx-auto w-full max-w-[960px] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-6' data-gekta-access-gate='true' role='status'>
      <div className='rounded-2xl border border-emerald-900/15 bg-[#eff5ee] p-5'>
        <div className='flex items-start gap-3'>
          <Lock className='mt-0.5 h-5 w-5 shrink-0 text-emerald-800' aria-hidden='true' />
          <div className='min-w-0'>
            <h2 className='text-base font-semibold text-slate-950'>{ui.title}</h2>
            <p className='mt-1 text-sm leading-6 text-slate-700'>{registrationUrl ? ui.withRegistration : ui.withoutRegistration}</p>
            <div className='mt-4 flex flex-wrap gap-3'>
              {registrationUrl ? (
                <a
                  href={registrationUrl}
                  className='inline-flex min-h-11 items-center rounded-full bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
                  data-gekta-registration-cta='true'
                >
                  {ui.cta}
                </a>
              ) : (
                <>
                  <Link href='/platform-v7/contact' className='inline-flex min-h-11 items-center rounded-full bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>
                    {ui.support}
                  </Link>
                  <Link href='/gekta' className='inline-flex min-h-11 items-center rounded-full border border-slate-300 px-5 text-sm font-semibold text-slate-700 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'>
                    {ui.product}
                  </Link>
                </>
              )}
            </div>
            <p className='mt-3 text-xs text-slate-500'>{ui.note}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
