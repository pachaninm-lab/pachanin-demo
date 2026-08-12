'use client';

import * as React from 'react';
import type { GektaLocale } from '@/lib/gekta/content';
import { GektaChatWorkspace } from './GektaChatWorkspace';
import { GEKTA_ENTER_CHAT_EVENT } from './GektaProductCta';

const FLOATING_LABEL: Record<GektaLocale, string> = {
  ru: 'Открыть диалог с Гектой',
  en: 'Open a conversation with Gekta',
  zh: '打开与 Gekta 的对话',
};

export function GektaExperienceFrame({ locale, hero, discovery }: { locale: GektaLocale; hero: React.ReactNode; discovery: React.ReactNode }) {
  const [enteredChat, setEnteredChat] = React.useState(false);
  return (
    <>
      <GektaChatWorkspace locale={locale} discoveryHero={enteredChat ? undefined : hero} onEnteredChat={() => setEnteredChat(true)} />
      {!enteredChat ? discovery : null}
      {/* The marketing page is long: a single icon-only shortcut back to the
          conversation. It disappears the moment the workspace takes over. */}
      {!enteredChat ? (
        <button
          type='button'
          onClick={() => window.dispatchEvent(new CustomEvent(GEKTA_ENTER_CHAT_EVENT, { detail: { source: 'floating' } }))}
          aria-label={FLOATING_LABEL[locale]}
          title={FLOATING_LABEL[locale]}
          data-gekta-floating-entry='product'
          className='fixed bottom-[max(16px,calc(env(safe-area-inset-bottom,0px)+16px))] right-[max(16px,env(safe-area-inset-right,0px))] z-40 grid h-14 w-14 place-items-center rounded-full bg-emerald-800 text-2xl font-black text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 motion-reduce:transform-none'
        >
          <span aria-hidden='true'>G</span>
        </button>
      ) : null}
    </>
  );
}
