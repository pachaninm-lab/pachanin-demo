import type { Metadata } from 'next';
import Link from 'next/link';
import { DisputeDetailRuntime } from '@/components/v7r/DisputeDetailRuntime';
import { selectDisputeById } from '@/lib/domain/selectors';
import { PLATFORM_V7_DISPUTES_ROUTE } from '@/lib/platform-v7/routes';

export function generateMetadata({ params }: { params: { id: string } }): Metadata {
  const dispute = selectDisputeById(params.id);
  return {
    title: dispute ? `Спор ${dispute.id}` : `Спор ${params.id}`,
    description: dispute
      ? `${dispute.title}: удержание, доказательства, SLA и следующий владелец действия.`
      : `Карточка спора ${params.id}: удержание, доказательства, SLA и следующий владелец действия.`,
  };
}

export default function PlatformV7DisputeDetailPage({ params }: { params: { id: string } }) {
  const dispute = selectDisputeById(params.id);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <DisputeDetailRuntime disputeId={params.id} />
      <section style={{ maxWidth: 860, margin: '0 auto', width: '100%', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0F1419' }}>Отдельный расчёт удержания</div>
        <div style={{ fontSize: 13, color: '#6B778C', lineHeight: 1.6 }}>
          {dispute
            ? `${dispute.title}: оператор видит рекомендуемое удержание без потери контекста спора.`
            : 'Для спорных кейсов с денежным риском вынесен отдельный маршрут, где оператор видит рекомендуемое удержание без потери контекста спора.'}
        </div>
        <div>
          <Link href={`${PLATFORM_V7_DISPUTES_ROUTE}/${params.id}/hold`} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
            Открыть калькулятор удержания
          </Link>
        </div>
      </section>
    </div>
  );
}
