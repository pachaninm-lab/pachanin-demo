const deals = [
  ['DL-9102', 'Пшеница 4 кл.', 'рейс в пути', 'нужна сверка ЭДО'],
  ['DL-9116', 'Ячмень', 'приёмка', 'расхождение по весу'],
  ['DL-9120', 'Кукуруза', 'документы', 'ожидается СДИЗ'],
];

const timeline = [
  ['Погрузка', 'фото · вес · пломба'],
  ['Транзит', 'маршрут · ETA · отклонения'],
  ['Приёмка', 'вес · очередь · акт'],
  ['Лаборатория', 'протокол · дельта качества'],
  ['Деньги', 'удержание · выпуск · возврат'],
];

export default function PremiumMockups() {
  return (
    <section id="mockup" className="lux-line relative z-10 py-24 grid-bg">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 max-w-3xl">
          <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-mint">мокап рабочего контура</div>
          <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Сайт должен выглядеть как система контроля денег, а не как красивая витрина.</h2>
          <p className="text-lg leading-relaxed text-[#8BA89E]">Показываем объекты доверия: сделка, маршрут, качество, документы, деньги, спор и следующий ответственный шаг.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="premium-panel rounded-[34px] p-5">
            <div className="rounded-[26px] bg-[#07110E] p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[#4A6B5E]">операторский контур</div>
                  <div className="mt-1 text-2xl font-black text-white">Активные сделки</div>
                </div>
                <div className="rounded-full bg-[rgba(126,242,196,0.08)] px-3 py-1 text-xs text-mint">controlled pilot</div>
              </div>
              <div className="space-y-3">
                {deals.map(([id, crop, status, blocker]) => (
                  <div key={id} className="grid gap-3 rounded-2xl border border-[rgba(126,242,196,0.09)] bg-[#101B18] p-4 md:grid-cols-4">
                    <span className="font-mono text-sm text-mint">{id}</span>
                    <span className="text-sm font-semibold text-white">{crop}</span>
                    <span className="text-sm text-[#8BA89E]">{status}</span>
                    <span className="rounded-full border border-[rgba(245,180,30,0.18)] bg-[rgba(245,180,30,0.06)] px-3 py-1 text-center text-xs text-[#F5B41E]">{blocker}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-5">
                {timeline.map(([title, text]) => (
                  <div key={title} className="rounded-2xl border border-[rgba(126,242,196,0.08)] bg-[#0B1513] p-4">
                    <div className="text-xs font-bold text-white">{title}</div>
                    <div className="mt-2 text-[11px] leading-relaxed text-[#6F8C82]">{text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-5">
            <div className="premium-card rounded-[30px] p-6">
              <div className="text-xs uppercase tracking-[0.18em] text-[#4A6B5E]">деньги</div>
              <div className="mt-3 text-4xl font-black text-white">70%</div>
              <div className="mt-2 text-sm text-[#8BA89E]">к выпуску только после закрытия ЭДО и сверки качества</div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#07110E]"><div className="h-full w-[70%] rounded-full bg-mint" /></div>
            </div>
            <div className="premium-card rounded-[30px] p-6">
              <div className="text-xs uppercase tracking-[0.18em] text-[#4A6B5E]">спор</div>
              <div className="mt-3 text-xl font-black text-white">Пакет доказательств собирается до конфликта</div>
              <p className="mt-3 text-sm leading-relaxed text-[#8BA89E]">Вес, лаборатория, фото, маршрут, документы и ответственные остаются в одном следе сделки.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
