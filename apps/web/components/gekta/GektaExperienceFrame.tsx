'use client';

import * as React from 'react';
import type { GektaLocale } from '@/lib/gekta/content';
import { GektaChatWorkspace } from './GektaChatWorkspace';

export function GektaExperienceFrame({ locale, hero, discovery }: { locale: GektaLocale; hero: React.ReactNode; discovery: React.ReactNode }) {
  const [enteredChat, setEnteredChat] = React.useState(false);
  return (
    <div data-gekta-experience={enteredChat ? 'chat' : 'discovery'}>
      <GektaChatWorkspace locale={locale} discoveryHero={enteredChat ? undefined : hero}
        discoveryFooter={enteredChat ? undefined : discovery} onEnteredChat={() => setEnteredChat(true)} />
    </div>
  );
}
