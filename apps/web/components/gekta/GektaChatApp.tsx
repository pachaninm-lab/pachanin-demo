'use client';

import { GektaChatWorkspace } from './GektaChatWorkspace';

/** Compatibility export for older imports. The canonical /gekta route uses GektaProductShell. */
export function GektaChatApp() {
  return <GektaChatWorkspace locale='ru' />;
}
