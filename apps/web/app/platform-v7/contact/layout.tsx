import type { ReactNode } from 'react';
import { ContactFixedHeader } from '@/components/platform-v7/ContactFixedHeader';

export default function PlatformV7ContactLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ContactFixedHeader />
      {children}
    </>
  );
}
