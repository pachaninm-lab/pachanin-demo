import Link from 'next/link';
import { PlatformRolesHub } from '@/components/v7r/PlatformRolesHub';

export default function PlatformV7RolesPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Link href='/platform-v7/market-rfq' style={{ padding: 16, border: '1px solid #E4E6EA', borderRadius: 18, background: '#fff', color: '#0A7A5F', fontWeight: 800, textDecoration: 'none' }}>
        Market / RFQ →
      </Link>
      <PlatformRolesHub />
    </div>
  );
}
