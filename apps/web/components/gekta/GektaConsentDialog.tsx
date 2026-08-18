'use client';

import * as React from 'react';
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
  },
  en: {
    title: 'Before you start',
    body: 'Gekta uses artificial intelligence to help work through agricultural tasks. Answers may need checking and do not replace a qualified specialist.',
    accept: 'By continuing you accept the',
    terms: 'terms of use',
    and: 'and the',
    privacy: 'privacy policy',
    cta: 'Got it, start',
  },
  zh: {
    title: '开始之前',
    body: 'Gekta 使用人工智能帮助分析农业任务。回答可能需要核实，且不能替代专业人员。',
    accept: '继续即表示您接受',
    terms: '使用条款',
    and: '与',
    privacy: '隐私政策',
    cta: '知道了，开始',
  },
} as const;

function activeDraftAtMount(): boolean {
  if (typeof document === 'undefined') return false;
  const composer = document.getElementById('gekta-composer-input');
  return composer instanceof HTMLTextAreaElement
    && (document.activeElement === composer || composer.value.trim().length > 0);
}

/**
 * One compact notice before the first conversation. Acceptance is recorded
 * server-side against the session id and the document version, so it is not
 * shown again until the documents actually change.
 *
 * The entitlement probe is asynchronous. If its answer arrives after a person
 * has already started typing, the notice waits for the next submit intent
 * instead of stealing focus from the composer while the mobile keyboard owns
 * the visual viewport. The intercepted submit is never sent before consent.
 */
export function GektaConsentDialog({ locale, onAccept }: { locale: GektaLocale; onAccept: () => void }) {
  const ui = UI[locale];
  const [deferred, setDeferred] = React.useState(activeDraftAtMount);
  // Accepting is the only way out: Escape is swallowed but never treated as consent.
  const ignoreEscape = React.useCallback(() => {}, []);
  const panelRef = useDialogFocus(!deferred, ignoreEscape);
  const legalLinkClass = 'inline-flex min-h-11 items-center font-medium text-emerald-800 underline underline-offset-2 sm:min-h-0';

  React.useEffect(() => {
    if (!deferred) return undefined;

    const reveal = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      setDeferred(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLTextAreaElement) || target.id !== 'gekta-composer-input') return;
      if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
      reveal(event);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("[data-gekta-submit='true']")) return;
      reveal(event);
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('click', onClick, true);
    };
  }, [deferred]);

  if (deferred) return null;

  return (
    <div className='fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4'>
      <div
        ref={panelRef}
        role='dialog'
        aria-modal='true'
        aria-labelledby='gekta-consent-title'
        data-gekta-consent='true'
        className='w-full rounded-t-3xl bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] shadow-2xl sm:max-w-md sm:rounded-3xl sm:pb-5'
      >
        <h2 id='gekta-consent-title' className='text-base font-semibold text-slate-950'>{ui.title}</h2>
        <p className='mt-2 text-sm leading-6 text-slate-600'>{ui.body}</p>
        <p className='mt-3 text-xs leading-5 text-slate-500'>
          {ui.accept}{' '}
          <Link href='/legal/usloviya-ispolzovaniya-gekta' className={legalLinkClass}>{ui.terms}</Link>{' '}
          {ui.and}{' '}
          <Link href='/legal/politika-konfidencialnosti' className={legalLinkClass}>{ui.privacy}</Link>.
        </p>
        <button
          type='button'
          onClick={onAccept}
          className='mt-5 min-h-11 w-full rounded-xl bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700'
          data-gekta-consent-accept='true'
        >
          {ui.cta}
        </button>
      </div>
    </div>
  );
}
