const roles = [
  ['Продавец / КФХ', 'Понимает, почему удержали деньги и какие факты нужны для оплаты.'],
  ['Покупатель', 'Видит, что реально приехало: вес, качество, документы и риск.'],
  ['Элеватор', 'Фиксирует приёмку так, чтобы потом не спорить по перепискам.'],
  ['Логистика', 'Видит рейс, водителя, маршрут, статус и задержки в одном месте.'],
  ['Банк', 'Понимает, когда деньги можно выпускать, а когда нужно удержать.'],
  ['Регион / инвестор', 'Видит не обещания, а управляемую цепочку сделки и рисков.'],
];

export default function RoleEntry() {
  return (
    <section id="roles" className="relative z-10 py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 max-w-3xl">
          <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-mint">для кого</div>
          <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Каждый участник видит своё место в сделке.</h2>
          <p className="text-lg leading-relaxed text-[#8BA89E]">Никакой абстрактной платформы. У каждого участника один понятный вопрос: что происходит сейчас и что нужно сделать дальше.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map(([title, text]) => (
            <a href="#contact" key={title} className="premium-card group rounded-2xl p-6 transition hover:-translate-y-1">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h3 className="text-lg font-black text-white">{title}</h3>
                <span className="shrink-0 rounded-full border border-[rgba(126,242,196,0.12)] px-3 py-1 text-xs font-bold text-mint transition group-hover:border-[rgba(126,242,196,0.35)]">выбрать</span>
              </div>
              <p className="text-sm leading-relaxed text-[#8BA89E]">{text}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
