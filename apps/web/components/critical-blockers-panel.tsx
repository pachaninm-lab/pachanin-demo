export function CriticalBlockersPanel({
  title = 'Критические блокеры',
  items,
  emptyLabel = 'Критических блокеров нет.'
}: {
  title?: string;
  items: Array<string | null | undefined | false>;
  emptyLabel?: string;
}) {
  const normalized = Array.from(new Set(items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean)));
  const hasItems = normalized.length > 0;
  return (
    <section className={`rounded-2xl border p-4 ${hasItems ? 'border-yellow-300 bg-yellow-50' : 'border-emerald-200 bg-emerald-50'}`}>
      <div className="text-sm font-semibold">{title}</div>
      {hasItems ? (
        <ul className="mt-2 space-y-1 text-sm text-yellow-950">
          {normalized.map((item) => <li key={item}>• {item}</li>)}</ul>
      ) : (
        <div className="mt-2 text-sm text-emerald-900">{emptyLabel}</div>
      )}
    </section>
  );
}
