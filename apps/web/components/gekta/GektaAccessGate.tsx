'use client';

import type * as React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { GektaLocale } from '@/lib/gekta/content';
import type { GektaEntitlementSnapshot } from '@/lib/gekta/entitlement';
import { getGektaAccessPolicy } from '@/lib/gekta/entitlement';

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
    trialUntil: (date: string) => `Пробный доступ до ${date}`,
    trialExpired: 'Пробный период завершён',
    paywall: (price: number) => `Продолжите работу с Гектой — ${price} ₽ в месяц.`,
    buy: 'Купить доступ',
    billingPending: 'Приём оплаты ещё не подключён. Напишите в поддержку — владелец может открыть доступ вручную.',
    pastDue: 'Платёж не прошёл',
    pastDueBody: 'Обновите платёжное средство или напишите в поддержку.',
    cancelled: 'Подписка отменена',
    cancelledBody: 'Доступ можно возобновить в любой момент.',
    suspended: 'Доступ приостановлен',
    suspendedBody: 'Обратитесь в поддержку, чтобы разобраться в причине.',
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
    trialUntil: (date: string) => `Trial access until ${date}`,
    trialExpired: 'Your trial has ended',
    paywall: (price: number) => `Continue with Gekta for ${price} ₽ per month.`,
    buy: 'Buy access',
    billingPending: 'Payments are not connected yet. Contact support — the owner can open access manually.',
    pastDue: 'The payment did not go through',
    pastDueBody: 'Update the payment method or contact support.',
    cancelled: 'Subscription cancelled',
    cancelledBody: 'You can resume access at any time.',
    suspended: 'Access is suspended',
    suspendedBody: 'Contact support to resolve the reason.',
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
    trialUntil: (date: string) => `试用有效期至 ${date}`,
    trialExpired: '试用期已结束',
    paywall: (price: number) => `继续使用 Gekta — 每月 ${price} ₽。`,
    buy: '购买访问权限',
    billingPending: '支付功能尚未接入。请联系支持，所有者可以手动开通访问。',
    pastDue: '付款未成功',
    pastDueBody: '请更新支付方式或联系支持。',
    cancelled: '订阅已取消',
    cancelledBody: '您可以随时恢复访问。',
    suspended: '访问已暂停',
    suspendedBody: '请联系支持了解原因。',
  },
} as const;

const DATE_LOCALE: Record<GektaLocale, string> = { ru: 'ru-RU', en: 'en-GB', zh: 'zh-CN' };

/** Точная дата вместо расплывчатого обещания: срок ставит сервер. */
function formatExpiry(locale: GektaLocale, iso: string): string {
  return new Date(iso).toLocaleDateString(DATE_LOCALE[locale], { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function localizedRegistrationUrl(value: string, locale: GektaLocale): string {
  const url = new URL(value, 'https://gekta.local');
  url.searchParams.set('lang', locale);
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Строка состояния доступа: остаток бесплатных ответов в анонимном режиме или
 * дата окончания пробного доступа. Оба значения приходят с сервера.
 */
export function GektaRemainingBadge({ locale, entitlement }: { locale: GektaLocale; entitlement: GektaEntitlementSnapshot | null }) {
  if (!entitlement || !entitlement.canAsk) return null;
  const ui = UI[locale];

  if (entitlement.state === 'TRIAL_ACTIVE' && entitlement.expiresAt) {
    return (
      <span className='hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 sm:inline' data-gekta-trial-badge='true'>
        {ui.trialUntil(formatExpiry(locale, entitlement.expiresAt))}
      </span>
    );
  }

  if (entitlement.remaining === null || entitlement.limit === null) return null;
  return (
    <span className='hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 sm:inline' data-gekta-remaining='true'>
      {ui.remaining(entitlement.remaining, entitlement.limit)}
    </span>
  );
}

const PRIMARY_ACTION = 'inline-flex min-h-11 items-center rounded-full bg-emerald-800 px-5 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700';

function GateShell({ locale, title, body, children }: { locale: GektaLocale; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className='mx-auto w-full max-w-[960px] px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 sm:px-6' data-gekta-access-gate='true' role='status'>
      <div className='rounded-2xl border border-emerald-900/15 bg-[#eff5ee] p-5'>
        <div className='flex items-start gap-3'>
          <Lock className='mt-0.5 h-5 w-5 shrink-0 text-emerald-800' aria-hidden='true' />
          <div className='min-w-0'>
            <h2 className='text-base font-semibold text-slate-950'>{title}</h2>
            <p className='mt-1 text-sm leading-6 text-slate-700'>{body}</p>
            <div className='mt-4 flex flex-wrap items-center gap-3'>{children}</div>
            <p className='mt-3 text-xs text-slate-500'>{UI[locale].note}</p>
          </div>
        </div>
      </div>
    </div>
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
export function GektaAccessGate({ locale, registrationUrl, entitlement, billingEnabled = false }: {
  locale: GektaLocale;
  registrationUrl: string | null;
  entitlement?: GektaEntitlementSnapshot | null;
  billingEnabled?: boolean;
}) {
  const ui = UI[locale];
  const state = entitlement?.state ?? 'REGISTRATION_REQUIRED';

  if (state === 'TRIAL_EXPIRED' || state === 'CANCELLED') {
    // Платёж предлагается только когда его действительно можно совершить:
    // изображать успешное списание при выключенном биллинге запрещено.
    return (
      <GateShell locale={locale} title={state === 'CANCELLED' ? ui.cancelled : ui.trialExpired} body={state === 'CANCELLED' ? ui.cancelledBody : ui.paywall(getGektaAccessPolicy().monthlyPriceRub)}>
        {billingEnabled ? (
          <Link href='/gekta/subscribe' className={PRIMARY_ACTION} data-gekta-buy-cta='true'>{ui.buy}</Link>
        ) : (
          <>
            <p className='w-full text-sm leading-6 text-slate-700' data-gekta-billing-pending='true'>{ui.billingPending}</p>
            <Link href='/platform-v7/contact' className={PRIMARY_ACTION}>{ui.support}</Link>
          </>
        )}
      </GateShell>
    );
  }

  if (state === 'PAST_DUE' || state === 'SUSPENDED') {
    return (
      <GateShell locale={locale} title={state === 'PAST_DUE' ? ui.pastDue : ui.suspended} body={state === 'PAST_DUE' ? ui.pastDueBody : ui.suspendedBody}>
        <Link href='/platform-v7/contact' className={PRIMARY_ACTION}>{ui.support}</Link>
      </GateShell>
    );
  }

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
                  href={localizedRegistrationUrl(registrationUrl, locale)}
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
