import type { ReactNode } from 'react';
import { DecisionPackRoutePlacement } from '@/components/platform-v7/DecisionPackRoutePlacement';

export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <DecisionPackRoutePlacement route='/platform-v7/seller' context='seller_document_handoff' />
    </>
  );
}
