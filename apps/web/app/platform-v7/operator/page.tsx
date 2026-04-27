import Link from 'next/link';
import { OperatorQueuesPage } from '@/components/v7r/EsiaFgisRuntime';

export default function PlatformV7OperatorAliasPage() {
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Link
        href='/platform-v7/bank/release-safety'
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
        Проверка выпуска денег →
      </Link>
      <OperatorQueuesPage />
    </div>
  );
}
