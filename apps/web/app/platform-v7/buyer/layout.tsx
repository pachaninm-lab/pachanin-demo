import type { ReactNode } from 'react';
import { BuyerDecisionPackRoutePlacement } from '@/components/platform-v7/BuyerDecisionPackRoutePlacement';

export default function BuyerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <BuyerDecisionPackRoutePlacement />
    </>
  );
}
