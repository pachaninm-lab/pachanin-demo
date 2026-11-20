'use client';

import Link from 'next/link';
import type { GektaLocale } from '@/lib/gekta/content';
import { useDialogFocus } from './useDialogFocus';

const UI = {
  ru: {
    title: 'Перед началом',
    body: 'Гекта использует искусственный интеллект и помогает разбираться в аграрных задачах. Ответы могут требовать проверки и не заменяют профильного специалиста.',
    accept: 'Продолжая, вы принимаете',
    terms: 'условия использования',
    and: 'и',
    privacy: 'политику конфиденциальности',
    cta: 'Понятно, начать',
    back: 'Вернуться к вопросу',
    failed: 'Не удалось сохранить подтверждение. Попробуйте ещё раз.',
  },
  en: {
    title: 'Before you start',
    body: 'Gekta uses artificial intelligence to help work through agricultural tasks. Answers may need checking and do not replace a qualified specialist.',
    accept: 'By continuing you accept the',
    terms: 'terms of use',
    and: 'and the',
    privacy: 'privacy policy',
    cta: 'Got it, start',
    back: 'Back to my question',
    failed: 'Could not save your confirmation. Please try again.',
  },
  zh: {
    title: '开始之前',
    body: 'Gekta 使用人工智能帮助分析农业任务。回答可能需要核实，且不能替代专业人员。',
    accept: '继续即表示您接受',
    terms: '使用条款',
    and: '与',
    privacy: '隐私政策',
    cta: '知道了，开始',
    back: '返回问题',
    failed: '无法保存确认，请重试。',
  },
} as const;

function currentComposer() {
  return document.getElementById('gekta-composer-input');
}

/** The server requests this notice when an answer needs fresh consent. */
export function GektaConsentDialog({ locale, onAccept, onDismiss, termsHref = '/legal/usloviya-ispolzovaniya-gekta', privacyHref = '/legal/politika-konfidencialnosti', disabled = false, failed = false }: {
  locale: GektaLocale; onAccept: () => void; onDismiss: () => void; termsHref?: string; privacyHref?: string; disabled?: boolean; failed?: boolean;
}) {
  const ui = UI[locale];
  const panelRef = useDialogFocus(true, onDismiss, currentComposer);
  const legalLinkClass = 'inline-flex min-h-11 items-center font-medium text-emerald-800 underline underline-offset-2 sm:min-h-0';

  return (
    <div className='fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4'>
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby='gekta-consent-title'
        aria-describedby='gekta-consent-description'
        data-gekta-consent='true'
        className='max-h-[100dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl sm:pb-5'
      >
        <h2 id='gekta-consent-title' tabIndex={-1} data-gekta-initial-focus='true' className='text-base font-semibold text-slate-950'>{ui.title}</h2>
        <p id='gekta-consent-description' className='mt-2 text-sm leading-6 text-slate-600'>{ui.body}</p>
        <p className='mt-3 text-xs leading-5 text-slate-500'>
          {ui.accept}{' '}
          <Link href={termsHref} className={legalLinkClass}>{ui.terms}</Link>{' '}
          {ui.and}{' '}
          <Link href={privacyHref} className={legalLinkClass}>{ui.privacy}</Link>.
        </p>
        {failed ? <p role='alert' className='mt-3 text-sm text-red-700'>{ui.failed}</p> : null}
        <button
          type='button'
          onClick={onAccept}
          disabled={disabled}
          className='mt-5 min-h-11 w-full rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
          data-gekta-consent-accept='true'
        >
          {ui.cta}
        </button>
        <button
          type='button'
          onClick={onDismiss}
          className='mt-1 min-h-11 w-full rounded-xl px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
          data-gekta-consent-dismiss='true'
        >
          {ui.back}
        </button>
      </div>
    </div>
  );
}
