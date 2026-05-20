import { SellerLotsRuntimeV2 } from '@/components/v7r/SellerLotsRuntimeV2';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';

export default function PlatformV7LotsPage() {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <TrustDot state='test' size='sm' label='Тестовый контур · Внешние подключения требуют договоров' />
      </div>
      <SellerLotsRuntimeV2 />
    </div>
  );
}
