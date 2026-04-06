'use client';

type DriverMapProps = {
  title?: string;
  points?: Array<{ name: string; meta?: string }>;
};

export function DriverMap({
  title = 'Route checkpoints',
  points = [
    { name: 'Загрузка', meta: 'старт' },
    { name: 'Маршрут', meta: 'в пути' },
    { name: 'Приёмка', meta: 'финиш' }
  ]
}: DriverMapProps) {
  return (
    <section className="section-card-tight">
      <div className="section-title">{title}</div>
      <div className="mt-4 space-y-3">
        {points.map((point, index) => (
          <div key={`${point.name}-${index}`} className="flex items-start gap-3 rounded-xl border border-white/8 px-3 py-2">
            <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-sky-400/40 bg-sky-400/10 text-xs text-sky-200">{index + 1}</div>
            <div>
              <div className="text-sm font-medium text-white">{point.name}</div>
              {point.meta ? <div className="muted small" style={{ marginTop: 4 }}>{point.meta}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
