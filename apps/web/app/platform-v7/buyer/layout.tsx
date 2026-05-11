import type { ReactNode } from 'react';
import { DecisionPackRoutePlacement } from '@/components/platform-v7/DecisionPackRoutePlacement';

export default function BuyerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <DecisionPackRoutePlacement route='/platform-v7/buyer' context='buyer_reserve_request' />
    </>
  );
}
