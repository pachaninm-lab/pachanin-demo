const rows = [
  ['DL-9102', 'Пшеница 4 кл.', 'рейс в пути', 'есть риск'],
  ['DL-9116', 'Ячмень', 'приёмка', 'недовес'],
  ['DL-9120', 'Кукуруза', 'документы', 'ждём ЭДО'],
];

export default function PremiumMockups() {
  return (
    <section id="mockup" className="lux-line relative z-10 py-20 grid-bg md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 max-w-3xl">
          <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-mint">как выглядит контроль</div>
          <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Один экран вместо десятков звонков.</h2>
          <p className="text-lg leading-relaxed text-[#8BA89E]">Пользователь видит сделку, статус, риск, деньги, документы и следующий шаг. Без поиска по чатам и таблицам.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="premium-panel rounded-[34px] p-5">
            <div className="rounded-[26px] bg-[#07110E] p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[#4A6B5E]">центр сделки</div>
                  <div className="mt-1 text-2xl font-black text-white">Что требует внимания</div>
                </div>
                <div className="rounded-full bg-[rgba(126,242,196,0.08)] px-3 py-1 text-xs font-bold text-mint">пример</div>
              </div>
              <div className="space-y-3">
                {rows.map(([id, crop, status, risk]) => (
                  <div key={id} className="grid gap-3 rounded-2xl border border-[rgba(126,242,196,0.09)] bg-[#101B18] p-4 md:grid-cols-4">
                    <span className="font-mono text-sm text-mint">{id}</span>
                    <span className="text-sm font-semibold text-white">{crop}</span>
                    <span className="text-sm text-[#8BA89E]">{status}</span>
                    <span className="rounded-full border border-[rgba(245,180,30,0.18)] bg-[rgba(245,180,30,0.06)] px-3 py-1 text-center text-xs font-bold text-[#F5B41E]">{risk}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-5">
            <div className="premium-card rounded-[30px] p-6">
              <div className="text-xs uppercase tracking-[0.18em] text-[#4A6B5E]">деньги</div>
              <div className="mt-3 text-4xl font-black text-white">70%</div>
              <div className="mt-2 text-sm text-[#8BA89E]">можно выпускать после сверки веса и документов</div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#07110E]"><div className="h-full w-[70%] rounded-full bg-mint" /></div>
            </div>
            <div className="premium-card rounded-[30px] p-6">
              <div className="text-xs uppercase tracking-[0.18em] text-[#4A6B5E]">спор</div>
              <div className="mt-3 text-xl font-black text-white">Факты собираются заранее</div>
              <p className="mt-3 text-sm leading-relaxed text-[#8BA89E]">Вес, лаборатория, фото, маршрут, документы и ответственные остаются в одном следе сделки.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
