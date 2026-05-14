import Link from 'next/link';
import { P7HiddenDetails } from '@/components/platform-v7/P7HiddenDetails';
import { OPERATOR_QUEUE_ITEMS, getStopCount, type OperatorQueueItem, type QueuePriority } from '../../lib/platform-v7/operator-execution-queue';

const microStyle = { color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.07em' } as const;

const PRIORITY_LABELS: Record<QueuePriority, string> = {
  stop: 'стоп',
  wait: 'ожидание',
  info: 'информация',
};

const PRIORITY_COLORS: Record<QueuePriority, string> = {
  stop: '#B91C1C',
  wait: '#B45309',
  info: '#0A7A5F',
};

function QueueRow({ item }: { item: OperatorQueueItem }) {
  const priorityColor = PRIORITY_COLORS[item.priority];

  return (
    <div
      data-testid='platform-v7-operator-queue-row'
      style={{
        background: '#F8FAFB',
        border: `1px solid ${item.priority === 'stop' ? 'rgba(185,28,28,0.18)' : '#E4E6EA'}`,
        borderRadius: 16,
        padding: 14,
        display: 'grid',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          data-testid='platform-v7-operator-queue-priority'
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '3px 9px',
            borderRadius: 999,
            background: `${priorityColor}14`,
            border: `1px solid ${priorityColor}30`,
            color: priorityColor,
            fontSize: 11,
            fontWeight: 900,
            textTransform: 'uppercase' as const,
            letterSpacing: '0.07em',
          }}
        >
          {PRIORITY_LABELS[item.priority]}
        </span>
        <span style={{ color: '#64748B', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>{item.slaLabel}</span>
        <span style={{ marginLeft: 'auto', color: '#0F1419', fontSize: 12, fontWeight: 900 }}>{item.id}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8 }}>
        <Field label='объект' value={item.entityId} />
        <Field label='деньги под риском' value={item.moneyAtRisk} color='#B91C1C' />
        <Field label='ответственный' value={item.ownerRole} />
      </div>

      <P7HiddenDetails title='Детали блокера' meta='причина, требуемое действие, безопасный шаг и почему нельзя исполнить сейчас'>
        <div
          data-testid='platform-v7-operator-queue-blocker'
          style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 10, display: 'grid', gap: 6 }}
        >
          <div style={microStyle}>блокер</div>
          <div style={{ color: '#0F1419', fontSize: 13, lineHeight: 1.4, fontWeight: 900 }}>{item.blocker}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 8 }}>
          <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 10, display: 'grid', gap: 5 }}>
            <div style={microStyle}>требуемое действие</div>
            <div style={{ color: '#0F1419', fontSize: 12, lineHeight: 1.45 }}>{item.requiredAction}</div>
          </div>
          <div
            data-testid='platform-v7-operator-queue-safe-next'
            style={{ background: '#fff', border: '1px solid rgba(10,122,95,0.2)', borderRadius: 12, padding: 10, display: 'grid', gap: 5 }}
          >
            <div style={microStyle}>безопасный следующий шаг</div>
            <div style={{ color: '#0F1419', fontSize: 12, lineHeight: 1.45 }}>{item.safeNextAction}</div>
          </div>
        </div>

        <div
          data-testid='platform-v7-operator-queue-why-not'
          style={{ background: 'rgba(185,28,28,0.04)', border: '1px solid rgba(185,28,28,0.1)', borderRadius: 12, padding: 10, display: 'grid', gap: 5 }}
        >
          <div style={microStyle}>почему сейчас не исполнимо</div>
          <div style={{ color: '#64748B', fontSize: 12, lineHeight: 1.45 }}>{item.whyNotExecutable}</div>
        </div>
      </P7HiddenDetails>

      <Link
        href={item.href}
        style={{
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 36,
          padding: '8px 14px',
          borderRadius: 10,
          background: '#0A7A5F',
          color: '#fff',
          fontSize: 13,
          fontWeight: 900,
          width: 'fit-content',
        }}
      >
        Открыть карточку
      </Link>
    </div>
  );
}

function Field({ label, value, color = '#0F1419' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, padding: 10, display: 'grid', gap: 4 }}>
      <div style={microStyle}>{label}</div>
      <div style={{ color, fontSize: 13, fontWeight: 900, lineHeight: 1.3 }}>{value}</div>
    </div>
  );
}

export function OperatorExecutionQueue() {
  const stopCount = getStopCount();
  const total = OPERATOR_QUEUE_ITEMS.length;

  return (
    <div
      data-testid='platform-v7-operator-execution-queue'
      style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 24, padding: 18, display: 'grid', gap: 12 }}
    >
      <div style={{ display: 'grid', gap: 6 }}>
        <div style={microStyle}>очередь исполнения</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ color: '#0F1419', fontSize: 20, fontWeight: 950, lineHeight: 1 }}>
            Очередь оператора
          </span>
          <span
            data-testid='platform-v7-operator-queue-stop-count'
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '3px 9px',
              borderRadius: 999,
              background: 'rgba(185,28,28,0.08)',
              border: '1px solid rgba(185,28,28,0.18)',
              color: '#B91C1C',
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            {stopCount} блокеров из {total}
          </span>
        </div>
        <p style={{ margin: 0, color: '#64748B', fontSize: 13, lineHeight: 1.5 }}>
          Каждый элемент показывает ответственного и деньги под риском. Причина блокировки, требуемое действие и безопасный следующий шаг раскрываются отдельно.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {OPERATOR_QUEUE_ITEMS.map((item) => (
          <QueueRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}
