import type { ReactNode } from 'react';
import { DecisionPackRoutePlacement } from '@/components/platform-v7/DecisionPackRoutePlacement';

export default function ElevatorLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <DecisionPackRoutePlacement route='/platform-v7/elevator' context='dl9102_dispute_hold' />
    </>
  );
}
