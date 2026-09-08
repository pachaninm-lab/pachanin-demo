'use client';

import * as React from 'react';
import type { GektaLocale } from '@/lib/gekta/content';
import { GektaChatWorkspace } from './GektaChatWorkspace';

export function GektaExperienceFrame({ locale, hero, discovery, publicHeader }: { locale: GektaLocale; hero: React.ReactNode; discovery: React.ReactNode; publicHeader?: React.ReactNode }) {
  const [enteredChat, setEnteredChat] = React.useState(false);
  return (
    <div data-gekta-experience={enteredChat ? 'chat' : 'discovery'}>
      {!enteredChat && publicHeader ? <div className='pc-gekta-public-header' data-gekta-public-header='true'>{publicHeader}</div> : null}
      <GektaChatWorkspace locale={locale} discoveryHero={enteredChat ? undefined : hero} onEnteredChat={() => setEnteredChat(true)} />
      {!enteredChat ? discovery : null}
    </div>
  );
}
