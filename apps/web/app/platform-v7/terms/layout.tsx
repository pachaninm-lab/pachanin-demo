import type { ReactNode } from 'react';
import { PublicLegalLanguageFrame } from '@/components/platform-v7/PublicLegalLanguageFrame';

export default function LegalLayout({ children }: { children: ReactNode }) {
  return <PublicLegalLanguageFrame>{children}</PublicLegalLanguageFrame>;
}
