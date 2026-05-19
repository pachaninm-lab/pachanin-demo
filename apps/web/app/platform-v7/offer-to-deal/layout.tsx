import type { ReactNode } from 'react';

export default function PlatformV7OfferToDealLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`.pc-v4-pilot-note{display:none!important;}`}</style>
      {children}
    </>
  );
}
