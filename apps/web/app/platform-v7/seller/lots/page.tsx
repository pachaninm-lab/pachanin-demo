import { SellerLotsRuntimeV2 } from '@/components/v7r/SellerLotsRuntimeV2';
import Link from 'next/link';

export default function SellerLotsPage() {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: '#0A7A5F', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Продавец</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#0F1419', marginTop: 4, lineHeight: 1.2 }}>Мои лоты</div>
        </div>
        <Link href='/platform-v7/seller/lots/new' style={{ textDecoration: 'none', padding: '10px 16px', borderRadius: 12, background: '#0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          + Создать лот
        </Link>
      </div>
      <SellerLotsRuntimeV2 />
    </div>
  );
}
