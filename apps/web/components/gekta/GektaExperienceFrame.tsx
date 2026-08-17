'use client';

import * as React from 'react';
import type { GektaLocale } from '@/lib/gekta/content';
import { GektaChatWorkspace } from './GektaChatWorkspace';

export function GektaExperienceFrame({ locale, hero, discovery }: { locale: GektaLocale; hero: React.ReactNode; discovery: React.ReactNode }) {
  const [enteredChat, setEnteredChat] = React.useState(false);
  return (
    <>
      <GektaChatWorkspace locale={locale} discoveryHero={enteredChat ? undefined : hero} onEnteredChat={() => setEnteredChat(true)} />
      {!enteredChat ? discovery : null}
    </>
  );
}
