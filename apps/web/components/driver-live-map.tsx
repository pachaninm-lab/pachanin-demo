'use client';

type DriverLiveMapProps = {
  title?: string;
  subtitle?: string;
  etaMinutes?: number | null;
  checkpoints?: Array<{ label: string; status?: 'done' | 'active' | 'pending' }>;
};

export function DriverLiveMap({
  title = 'Live route map',
  subtitle = 'Онлайн-маршрут, ETA и текущая точка рейса.',
  etaMinutes,
  checkpoints = []
}: DriverLiveMapProps) {
  const items = checkpoints.length
    ? checkpoints
    : [
        { label: 'Старт маршрута', status: 'done' as const },
        { label: 'Контрольная точка', status: 'active' as const },
        { label: 'Приёмка / выгрузка', status: 'pending' as const }
      ];

  return (
    <section className="section-card-tight">
      <div className="panel-title-row">
        <div>
          <div className="section-title">{title}</div>
          <div className="muted small" style={{ marginTop: 6 }}>{subtitle}</div>
        </div>
        {typeof etaMinutes === 'number' ? <span className="mini-chip blue">ETA {etaMinutes} мин</span> : null}
      </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.03)] p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-slate-400">Route view</div>
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl border border-white/6 px-3 py-2">
              <div className="text-sm text-white">{item.label}</div>
              <span className={`mini-chip ${item.status === 'done' ? 'green' : item.status === 'active' ? 'blue' : 'gray'}`}>{item.status || 'pending'}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
