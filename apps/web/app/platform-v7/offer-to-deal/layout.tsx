import type { ReactNode } from 'react';
import { OfferBridgeShellTrim } from './OfferBridgeShellTrim';

export default function PlatformV7OfferToDealLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <OfferBridgeShellTrim />
      {children}
    </>
  );
}
