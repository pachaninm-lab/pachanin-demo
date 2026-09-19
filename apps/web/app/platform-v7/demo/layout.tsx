import type { ReactNode } from 'react';
import { DemoCleanClient } from './DemoCleanClient';

export default function PlatformV7DemoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <DemoCleanClient />
    </>
  );
}
