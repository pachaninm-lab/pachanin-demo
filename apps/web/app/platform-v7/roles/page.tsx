import Link from 'next/link';
import { PlatformRolesHub } from '@/components/v7r/PlatformRolesHub';

export default function PlatformV7RolesPage() {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Link
          href='/platform-v7/market-rfq'
          style={{
            display: 'block',
            padding: '12px 16px',
            borderRadius: 12,
            background: 'var(--pc-accent-bg)',
            border: '1px solid var(--pc-accent-border)',
            textDecoration: 'none',
          }}
        >
          <div style={{ fontWeight: 800, color: 'var(--pc-accent-strong)', fontSize: 15 }}>Market / RFQ</div>
          <div style={{ fontSize: 13, color: 'var(--pc-text-secondary)', marginTop: 2 }}>Лоты, заявки и оферты</div>
        </Link>
      </div>
      <PlatformRolesHub />
    </div>
  );
}
