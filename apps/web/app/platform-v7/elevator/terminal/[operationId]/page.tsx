import Link from 'next/link';
import { DEAL360_SCENARIOS } from '@/lib/platform-v7/deal360-source-of-truth';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';

const OPERATION_DATA: Record<string, {
  dealId: string; tripId: string; grain: string;
  expectedTons: number; actualTons: number; deviation: number;
  driverAlias: string; arrivalTime: string; actRequired: boolean; actSigned: boolean;
  qualityParams: { moisture: number; impurity: number; gluten: number; natweight: number };
}> = {
  'OP-2401': {
    dealId: Object.keys(DEAL360_SCENARIOS)[0] ?? 'DL-9106',
    tripId: 'TRIP-2403-001', grain: 'Пшеница 4 кл.',
    expectedTons: 240, actualTons: 238.8, deviation: -1.2,
    driverAlias: 'Водитель А.', arrivalTime: '11:14',
    actRequired: true, actSigned: false,
    qualityParams: { moisture: 12.8, impurity: 2.1, gluten: 23.6, natweight: 758 },
  },
  'OP-2402': {
    dealId: Object.keys(DEAL360_SCENARIOS)[1] ?? 'DL-9102',
    tripId: 'TRIP-2402-002', grain: 'Ячмень',
    expectedTons: 180, actualTons: 180.1, deviation: 0.1,
    driverAlias: 'Водитель Б.', arrivalTime: '09:30',
    actRequired: false, actSigned: true,
    qualityParams: { moisture: 12.4, impurity: 1.6, gluten: 0, natweight: 640 },
  },
};

const DEFAULT_OP = {
  dealId: 'DL-9106', tripId: 'TRIP-NEW', grain: 'Пшеница 4 кл.',
  expectedTons: 300, actualTons: 299.5, deviation: -0.5,
  driverAlias: 'Водитель', arrivalTime: '—',
  actRequired: false, actSigned: false,
  qualityParams: { moisture: 12.5, impurity: 1.8, gluten: 24.0, natweight: 762 },
};

export default function PlatformV7ElevatorOperationPage({ params }: { params: { operationId: string } }) {
  const { operationId } = params;
  const op = OPERATION_DATA[operationId] ?? DEFAULT_OP;
  const hasSignificantDeviation = Math.abs(op.deviation) > 0.5;

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Элеватор · Операция {operationId}
            </p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>{op.grain}</h1>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: muted }}>{op.dealId} · {op.tripId} · {op.driverAlias}</p>
          </div>
          <Link href='/platform-v7/elevator/terminal' style={{ textDecoration: 'none', padding: '8px 12px', borderRadius: 10, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>
            ← Терминал
          </Link>
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Взвешивание</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
          {[
            { label: 'Ожидалось', value: `${op.expectedTons} т`, color: muted },
            { label: 'Принято', value: `${op.actualTons} т`, color: hasSignificantDeviation ? amber : green },
            { label: 'Отклонение', value: `${op.deviation > 0 ? '+' : ''}${op.deviation.toFixed(1)} т`, color: hasSignificantDeviation ? amber : green },
            { label: 'Прибытие', value: op.arrivalTime, color: text },
          ].map((item) => (
            <div key={item.label} style={{ padding: '10px 14px', borderRadius: 12, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 4 }}>{item.value}</div>
            </div>
          ))}
        </div>
        {hasSignificantDeviation && !op.actSigned && (
          <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.18)', fontSize: 13, color: amber, fontWeight: 700 }}>
            Расхождение {Math.abs(op.deviation).toFixed(1)} т — необходим акт расхождения до банковской проверки
          </div>
        )}
        {op.actSigned && (
          <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(10,122,95,0.06)', border: '1px solid rgba(10,122,95,0.18)', fontSize: 13, color: green, fontWeight: 700 }}>
            Акт приёмки подписан · данные переданы в банковский контур
          </div>
        )}
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Качество при приёмке</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
          {[
            { label: 'Влажность', value: `${op.qualityParams.moisture}%` },
            { label: 'Сорная примесь', value: `${op.qualityParams.impurity}%` },
            ...(op.qualityParams.gluten > 0 ? [{ label: 'Клейковина', value: `${op.qualityParams.gluten}%` }] : []),
            { label: 'Натурная масса', value: `${op.qualityParams.natweight} г/л` },
          ].map((item) => (
            <div key={item.label} style={{ padding: '10px 14px', borderRadius: 12, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: text, marginTop: 4 }}>{item.value}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: muted }}>
          Проба передана в лабораторию · протокол качества формируется
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href={`/platform-v7/deals/${op.dealId}/clean`} style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: green, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Карточка сделки
        </Link>
        <Link href='/platform-v7/elevator/terminal' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Все операции
        </Link>
        {hasSignificantDeviation && !op.actSigned && (
          <Link href='/platform-v7/documents/grain' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: amber, color: '#fff', fontSize: 13, fontWeight: 800 }}>
            Загрузить акт расхождения
          </Link>
        )}
      </div>
    </div>
  );
}
