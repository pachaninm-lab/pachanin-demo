import Link from 'next/link';
import { PlatformRolesHub } from '@/components/v7r/PlatformRolesHub';
import { PLATFORM_V7_MARKET_RFQ_ROUTE } from '@/lib/platform-v7/routes';

export default function PlatformV7RolesPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Link
        href={PLATFORM_V7_MARKET_RFQ_ROUTE}
        style={{
          display: 'block',
          textDecoration: 'none',
          border: '1px solid rgba(10,122,95,0.18)',
          borderRadius: 18,
          padding: 16,
          background: 'rgba(10,122,95,0.08)',
          color: '#0A7A5F',
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        <span style={{ display: 'block', color: '#0F1419', fontSize: 18, fontWeight: 900 }}>Рынок и заявки</span>
        <span style={{ display: 'block', color: '#475569', fontSize: 13, fontWeight: 700, marginTop: 4 }}>Лоты, заявки и предложения</span>
      </Link>
      <PlatformRolesHub />
    </div>
  );
}
