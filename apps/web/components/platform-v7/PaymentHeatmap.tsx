'use client';

interface DayData {
  date: string; // 'YYYY-MM-DD'
  amountKopecks: number;
  dealCount: number;
}

interface Props {
  data: DayData[];
  year: number;
  month: number; // 0-based
}

function formatRub(kopecks: number): string {
  if (kopecks >= 1_000_000_00) return `${(kopecks / 1_000_000_00).toFixed(1)} млн ₽`;
  if (kopecks >= 1_000_00) return `${(kopecks / 1_000_00).toFixed(0)} тыс. ₽`;
  return `${(kopecks / 100).toFixed(0)} ₽`;
}

function getIntensity(amount: number, max: number): number {
  if (max === 0 || amount === 0) return 0;
  return Math.ceil((amount / max) * 4);
}

const INTENSITY_COLORS = [
  'transparent',
  'rgba(125,221,181,0.2)',
  'rgba(125,221,181,0.4)',
  'rgba(125,221,181,0.65)',
  'rgba(125,221,181,0.9)',
];

const MONTH_NAMES = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAY_NAMES = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

export function PaymentHeatmap({ data, year, month }: Props) {
  const maxAmount = Math.max(...data.map((d) => d.amountKopecks), 1);

  // Build calendar grid
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0

  const dataMap = new Map(data.map((d) => [d.date, d]));
  const cells: Array<{ day: number; date: string; data?: DayData } | null> = [];

  // Fill leading empty cells
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);

  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    const date = `${year}-${mm}-${dd}`;
    cells.push({ day: d, date, data: dataMap.get(date) });
  }

  const totalAmount = data.reduce((acc, d) => acc + d.amountKopecks, 0);
  const totalDeals = data.reduce((acc, d) => acc + d.dealCount, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--text-base)', color: 'var(--pc-text-primary)' }}>
          {MONTH_NAMES[month]} {year}
        </span>
        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--p7-color-brand)' }}>
          {formatRub(totalAmount)}
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--pc-text-muted)' }}>
          {totalDeals} выплат
        </span>
      </div>

      {/* Day headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {DAY_NAMES.map((d) => (
          <div key={d} style={{ fontSize: '10px', color: 'var(--pc-text-muted)', textAlign: 'center', padding: '2px 0', fontWeight: 600, letterSpacing: '0.04em' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />;
          const intensity = getIntensity(cell.data?.amountKopecks ?? 0, maxAmount);
          const bg = INTENSITY_COLORS[intensity];
          const today = new Date().toISOString().slice(0, 10);
          const isToday = cell.date === today;

          return (
            <div
              key={cell.date}
              title={cell.data ? `${cell.day}: ${formatRub(cell.data.amountKopecks)} · ${cell.data.dealCount} сделок` : String(cell.day)}
              style={{
                aspectRatio: '1',
                borderRadius: '4px',
                background: bg || 'var(--p7-color-surface-muted)',
                border: isToday ? '1.5px solid var(--p7-color-brand)' : '1px solid var(--p7-color-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: intensity >= 3 ? 'var(--p7-color-background)' : 'var(--pc-text-muted)',
                cursor: cell.data ? 'pointer' : 'default',
                fontWeight: intensity >= 3 ? 700 : 400,
              }}
            >
              {cell.day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
        <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>Меньше</span>
        {INTENSITY_COLORS.map((color, i) => (
          <div key={i} style={{ width: '12px', height: '12px', borderRadius: '2px', background: color || 'var(--p7-color-surface-muted)', border: '1px solid var(--p7-color-border)' }} />
        ))}
        <span style={{ fontSize: '10px', color: 'var(--pc-text-muted)' }}>Больше</span>
      </div>
    </div>
  );
}

// Demo data for March 2024
export function buildDemoPaymentHeatmapData(): DayData[] {
  return [
    { date: '2024-03-01', amountKopecks: 180_000_00, dealCount: 2 },
    { date: '2024-03-05', amountKopecks: 95_000_00,  dealCount: 1 },
    { date: '2024-03-07', amountKopecks: 450_000_00, dealCount: 3 },
    { date: '2024-03-12', amountKopecks: 120_000_00, dealCount: 1 },
    { date: '2024-03-15', amountKopecks: 820_000_00, dealCount: 5 },
    { date: '2024-03-18', amountKopecks: 340_000_00, dealCount: 2 },
    { date: '2024-03-20', amountKopecks: 65_000_00,  dealCount: 1 },
    { date: '2024-03-25', amountKopecks: 290_000_00, dealCount: 2 },
    { date: '2024-03-28', amountKopecks: 760_000_00, dealCount: 4 },
  ];
}
