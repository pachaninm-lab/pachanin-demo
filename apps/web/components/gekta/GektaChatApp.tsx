'use client';

import { GektaChatWorkspace } from './GektaChatWorkspace';
import type { GektaLocale } from '../../lib/gekta/content';

/** Compatibility export for older imports. The canonical /gekta route uses GektaProductShell. */
export function GektaChatApp({ locale = 'ru' }: { locale?: GektaLocale } = {}) {
  return <GektaChatWorkspace locale={locale} />;
}
