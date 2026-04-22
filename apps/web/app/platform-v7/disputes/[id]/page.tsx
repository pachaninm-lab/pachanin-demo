import type { Metadata } from 'next';
import Link from 'next/link';
import { DisputeDetailRuntime } from '@/components/v7r/DisputeDetailRuntime';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  return {
    title: `Спор ${params.id}`,
    description: `Карточка спора ${params.id}: удержание, доказательства, SLA и следующий владелец действия.`,
  };
}

export default function PlatformV7DisputeDetailPage({ params }: { params: { id: string } }) {
  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <DisputeDetailRuntime disputeId={params.id} />
      <section style={{ maxWidth: 860, margin: '0 auto', width: '100%', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>Отдельный расчёт удержания</div>
        <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.6 }}>
          Для спорных кейсов с денежным риском вынесен отдельный маршрут, где оператор видит рекомендуемый hold без потери контекста спора.
        </div>
        <div>
          <Link href={`/platform-v7/disputes/${params.id}/hold`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
            Открыть калькулятор удержания
          </Link>
        </div>
      </section>
    </div>
  );
}
