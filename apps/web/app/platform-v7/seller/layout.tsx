import type { ReactNode } from 'react';
import { RoleContinuityPanel } from '@/components/v7r/RoleContinuityPanel';

export default function SellerLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <RoleContinuityPanel role='seller' compact />
      {children}
    </div>
  );
}
