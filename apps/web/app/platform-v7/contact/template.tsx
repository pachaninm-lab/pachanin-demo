import type { ReactNode } from 'react';
import { ContactCopyNormalizer } from '@/components/platform-v7/ContactCopyNormalizer';

export default function PlatformV7ContactTemplate({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ContactCopyNormalizer />
    </>
  );
}
