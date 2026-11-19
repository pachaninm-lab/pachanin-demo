'use client';

import type * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Lock } from 'lucide-react';
import { GEKTA_PATHS, type GektaLocale } from '@/lib/gekta/content';
import type { GektaEntitlementSnapshot } from '@/lib/gekta/entitlement';
import { getGektaAccessPolicy } from '@/lib/gekta/entitlement';

const UI = {
  ru: {
    title: 'Бесплатные ответы закончились',
    withRegistration: 'Создай аккаунт, чтобы продолжить диалог и получить пробный доступ.',
    withoutRegistration: 'Регистрация пока недоступна. Поддержка подскажет, как продолжить.',
    cta: 'Зарегистрироваться',
    support: 'Написать в поддержку',
    note: 'История, сохранённая в этом браузере, остаётся доступной.',
    remaining: (left: number, limit: number) => `Бесплатно — ${left} из ${limit} ответов Гекты`,
    trialUntil: (date: string) => `Пробный доступ до ${date}`,
    trialExpired: 'Пробный период завершён',
    paywall: (price: number) => `Продолжите работу с Гектой — ${price} ₽ в месяц.`,
    renewal: 'Узнать о продлении доступа',
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
    withRegistration: 'Create an account to continue the conversation and start your trial.',
    withoutRegistration: 'Registration is currently unavailable. Support can help you continue.',
    cta: 'Register',
    support: 'Contact support',
    note: 'History saved in this browser stays available.',
    remaining: (left: number, limit: number) => `Free — ${left} of ${limit} Gekta answers left`,
    trialUntil: (date: string) => `Trial access until ${date}`,
    trialExpired: 'Your trial has ended',
    paywall: (price: number) => `Continue with Gekta for ${price} ₽ per month.`,
    renewal: 'Ask about renewing access',
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
    withRegistration: '创建账户后可继续对话并开始试用。',
    withoutRegistration: '注册暂不可用。请联系支持了解如何继续。',
    cta: '注册',
    support: '联系支持',
    note: '保存在此浏览器中的历史记录仍然可用。',
    remaining: (left: number, limit: number) => `免费 — 还剩 ${left} / ${limit} 次 Gekta 回答`,
    trialUntil: (date: string) => `试用有效期至 ${date}`,
    trialExpired: '试用期已结束',
    paywall: (price: number) => `继续使用 Gekta — 每月 ${price} ₽。`,
    renewal: '咨询续订',
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
export function GektaRemainingBadge({ locale, entitlement, compact = false }: { locale: GektaLocale; entitlement: GektaEntitlementSnapshot | null; compact?: boolean }) {
  if (!entitlement || !entitlement.canAsk) return null;
  const ui = UI[locale];
  const className = compact
    ? 'mt-2 block px-2 text-xs font-medium leading-5 text-slate-600 sm:hidden'
    : 'hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 sm:inline';

  if (entitlement.state === 'TRIAL_ACTIVE' && entitlement.expiresAt) {
    return (
      <span className={className} data-gekta-trial-badge='true'>
        {ui.trialUntil(formatExpiry(locale, entitlement.expiresAt))}
      </span>
    );
  }

  if (entitlement.remaining === null || entitlement.limit === null) return null;
  return (
    <span className={className} data-gekta-remaining='true'>
      {ui.remaining(entitlement.remaining, entitlement.limit)}
    </span>
  );
}

const PRIMARY_ACTION = 'inline-flex min-h-11 max-w-full items-center justify-center gap-2 rounded-xl bg-emerald-800 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700';

function GateShell({ locale, title, body, primary, children }: { locale: GektaLocale; title: string; body: string; primary: boolean; children: React.ReactNode }) {
  const Heading = primary ? 'h1' : 'h2';
  return (
    <div className='mx-auto w-full max-w-[820px]' data-gekta-access-gate='true'>
      <div className='flex items-start gap-3 rounded-2xl border border-emerald-900/15 bg-[#eff5ee] p-4 sm:p-5'>
        <span className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-emerald-800'>
          <Lock className='h-[18px] w-[18px]' aria-hidden='true' />
        </span>
        <div className='min-w-0'>
          <div role='status'>
            <Heading className={`${primary ? 'text-xl leading-7 tracking-tight sm:text-2xl' : 'text-base'} font-semibold text-slate-950`}>{title}</Heading>
            <p className='mt-1 text-sm leading-6 text-slate-700'>{body}</p>
          </div>
          <div className='mt-3 flex flex-wrap items-center gap-2'>{children}</div>
          <p className='mt-2.5 text-xs leading-5 text-slate-600'>{UI[locale].note}</p>
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
export function GektaAccessGate({ locale, registrationUrl, entitlement, primary = false, billingEnabled = false }: {
  locale: GektaLocale;
  registrationUrl: string | null;
  entitlement?: GektaEntitlementSnapshot | null;
  primary?: boolean;
  billingEnabled?: boolean;
}) {
  const ui = UI[locale];
  const state = entitlement?.state ?? 'REGISTRATION_REQUIRED';
  const support = `${GEKTA_PATHS[locale]}/support`;

  if (state === 'TRIAL_EXPIRED' || state === 'CANCELLED') {
    return (
      <GateShell locale={locale} primary={primary} title={state === 'CANCELLED' ? ui.cancelled : ui.trialExpired} body={state === 'CANCELLED' ? ui.cancelledBody : ui.paywall(getGektaAccessPolicy().monthlyPriceRub)}>
        {!billingEnabled ? <p className='w-full text-sm leading-6 text-slate-700' data-gekta-billing-pending='true'>{ui.billingPending}</p> : null}
        <Link href={support} className={PRIMARY_ACTION}>{billingEnabled ? ui.renewal : ui.support}</Link>
      </GateShell>
    );
  }

  if (state === 'PAST_DUE' || state === 'SUSPENDED') {
    return (
      <GateShell locale={locale} primary={primary} title={state === 'PAST_DUE' ? ui.pastDue : ui.suspended} body={state === 'PAST_DUE' ? ui.pastDueBody : ui.suspendedBody}>
        <Link href={support} className={PRIMARY_ACTION}>{ui.support}</Link>
      </GateShell>
    );
  }

  return (
    <GateShell locale={locale} primary={primary} title={ui.title} body={registrationUrl ? ui.withRegistration : ui.withoutRegistration}>
      {registrationUrl ? (
        <a href={localizedRegistrationUrl(registrationUrl, locale)} className={PRIMARY_ACTION} data-gekta-registration-cta='true'>
          {ui.cta}<ArrowRight className='h-4 w-4 shrink-0' aria-hidden='true' />
        </a>
      ) : (
        <Link href={support} className={PRIMARY_ACTION}>{ui.support}</Link>
      )}
    </GateShell>
  );
}
