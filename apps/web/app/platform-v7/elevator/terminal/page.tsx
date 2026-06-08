import Link from 'next/link';
import { lots } from '@/lib/v7r/esia-fgis-data';
import { DEAL360_SCENARIOS } from '@/lib/platform-v7/deal360-source-of-truth';

const border = '#E4E6EA';
const text = '#0F1419';
const muted = '#6B778C';
const green = '#0A7A5F';
const amber = '#B45309';
const red = '#B91C1C';

type OpStatus = 'pending' | 'in-progress' | 'weighing' | 'done' | 'blocked';

interface ElevatorOp {
  id: string;
  dealId: string;
  tripId: string;
  grain: string;
  expectedTons: number;
  actualTons: number | null;
  driverAlias: string;
  status: OpStatus;
  arrivalTime: string;
  actSigned: boolean;
}

const scenarios = Object.values(DEAL360_SCENARIOS);

const OPERATIONS: ElevatorOp[] = [
  {
    id: 'OP-2401',
    dealId: scenarios[0]?.dealId ?? 'DL-9106',
    tripId: 'TRIP-2403-001',
    grain: 'Пшеница 4 кл.',
    expectedTons: 240,
    actualTons: 238.8,
    driverAlias: 'Водитель А.',
    status: 'weighing',
    arrivalTime: '11:14',
    actSigned: false,
  },
  {
    id: 'OP-2402',
    dealId: scenarios[1]?.dealId ?? 'DL-9102',
    tripId: 'TRIP-2402-002',
    grain: 'Ячмень',
    expectedTons: 180,
    actualTons: 180.1,
    driverAlias: 'Водитель Б.',
    status: 'done',
    arrivalTime: '09:30',
    actSigned: true,
  },
  {
    id: 'OP-2403',
    dealId: scenarios[2]?.dealId ?? 'DL-9103',
    tripId: 'TRIP-2403-003',
    grain: 'Пшеница 3 кл.',
    expectedTons: 300,
    actualTons: null,
    driverAlias: 'Водитель В.',
    status: 'pending',
    arrivalTime: '14:00 (план)',
    actSigned: false,
  },
];

const statusStyle: Record<OpStatus, { label: string; color: string; bg: string; borderColor: string }> = {
  'pending': { label: 'ОЖИДАНИЕ', color: muted, bg: 'rgba(107,114,128,0.07)', borderColor: 'rgba(107,114,128,0.18)' },
  'in-progress': { label: 'РАЗГРУЗКА', color: amber, bg: 'rgba(217,119,6,0.07)', borderColor: 'rgba(217,119,6,0.18)' },
  'weighing': { label: 'ВЗВЕШИВАНИЕ', color: '#2563EB', bg: 'rgba(37,99,235,0.07)', borderColor: 'rgba(37,99,235,0.18)' },
  'done': { label: 'ПРИНЯТО', color: green, bg: 'rgba(10,122,95,0.07)', borderColor: 'rgba(10,122,95,0.18)' },
  'blocked': { label: 'БЛОКИРОВКА', color: red, bg: 'rgba(220,38,38,0.07)', borderColor: 'rgba(220,38,38,0.18)' },
};

const readyLotCount = lots.filter((l) => l.readiness.state === 'PASS').length;

export default function PlatformV7ElevatorTerminalPage() {
  const active = OPERATIONS.filter((op) => op.status !== 'done');

  return (
    <div style={{ display: 'grid', gap: 16, padding: '4px 0 24px' }}>
      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Элеватор · Терминал</p>
            <h1 style={{ margin: '6px 0 0', fontSize: 24, color: text, fontWeight: 800 }}>Операции приёмки</h1>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: muted, lineHeight: 1.7 }}>
              Рейсы, взвешивание, акты приёмки и расхождений. Подписанный акт открывает банковскую выплату.
            </p>
          </div>
          <Link href='/platform-v7/elevator' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#fff', border: `1px solid ${border}`, color: text, fontSize: 13, fontWeight: 700 }}>
            ← Кокпит элеватора
          </Link>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Активных операций', value: String(active.length), color: active.length > 0 ? amber : green },
            { label: 'Принято сегодня', value: String(OPERATIONS.filter((op) => op.status === 'done').length), color: green },
            { label: 'Готовых партий', value: String(readyLotCount), color: green },
          ].map((item) => (
            <div key={item.label} style={{ padding: '8px 12px', borderRadius: 10, background: '#F8FAFB', border: `1px solid ${border}` }}>
              <div style={{ fontSize: 10, color: muted, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 2 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: `1px solid ${border}`, borderRadius: 18, padding: 18, background: '#fff', display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: text }}>Очередь операций</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {OPERATIONS.map((op) => {
            const ss = statusStyle[op.status];
            const hasDeviation = op.actualTons !== null && Math.abs(op.actualTons - op.expectedTons) > 0.5;
            return (
              <div key={op.id} style={{ border: `1px solid ${hasDeviation && !op.actSigned ? 'rgba(217,119,6,0.18)' : border}`, borderRadius: 14, padding: 14, background: hasDeviation && !op.actSigned ? 'rgba(217,119,6,0.03)' : '#F8FAFB', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 800, color: green }}>{op.dealId}</span>
                      <span style={{ fontSize: 11, color: muted }}>{op.tripId}</span>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: text, marginTop: 3 }}>{op.grain}</div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                      {op.driverAlias} · прибытие {op.arrivalTime}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 12, color: muted }}>Ожидается: {op.expectedTons} т</span>
                      {op.actualTons !== null && (
                        <>
                          <span style={{ fontSize: 11, color: muted }}>→</span>
                          <span style={{ fontSize: 13, fontWeight: 800, color: hasDeviation ? amber : green }}>Принято: {op.actualTons} т</span>
                        </>
                      )}
                    </div>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: 999, background: ss.bg, border: `1px solid ${ss.borderColor}`, color: ss.color, fontSize: 11, fontWeight: 900 }}>
                    {ss.label}
                  </span>
                </div>
                {hasDeviation && !op.actSigned && (
                  <div style={{ fontSize: 12, color: amber, fontWeight: 700 }}>
                    Расхождение {(op.actualTons! - op.expectedTons).toFixed(1)} т — требуется акт расхождения
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link href={`/platform-v7/elevator/terminal/${op.id}`} style={{ textDecoration: 'none', padding: '7px 10px', borderRadius: 10, background: op.status !== 'done' ? green : '#fff', border: `1px solid ${op.status !== 'done' ? green : border}`, color: op.status !== 'done' ? '#fff' : text, fontSize: 12, fontWeight: 800 }}>
                    {op.status !== 'done' ? 'Открыть операцию' : 'Просмотр акта'}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/elevator' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: green, color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Кокпит элеватора
        </Link>
        <Link href='/platform-v7/documents/grain' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: `1px solid ${border}`, background: '#fff', color: text, fontSize: 13, fontWeight: 700 }}>
          Документы
        </Link>
      </div>
    </div>
  );
}
