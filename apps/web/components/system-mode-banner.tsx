export function SystemModeBanner({
  mode = 'Оператор',
  detail = 'Пилотный режим с ручным резервным контуром под контролем оператора платформы.'
}: {
  mode?: string;
  detail?: string;
}) {
  return (
    <div className="mb-4 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-4 py-3 text-sm text-sky-50">
      <div className="text-[11px] uppercase tracking-[0.22em] text-sky-200">режим системы</div>
      <div className="mt-1 font-semibold">{mode}</div>
      <div className="mt-1 text-sky-100/90">{detail}</div>
    </div>
  );
}
