const items = [
  ['Сумма под риском', 'сколько денег нельзя выпускать без сверки'],
  ['Блокеры оплаты', 'что держит release: вес, качество, ЭДО, СДИЗ или спор'],
  ['Слабые доказательства', 'где нет маршрута, фото, акта, протокола или истории действий'],
  ['Pilot-сценарий', 'какую одну цепочку можно проверить без лишних обещаний'],
];

export default function FortyEightHourResult() {
  return (
    <section id="48h" className="relative z-10 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 max-w-3xl">
          <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-mint">за 48 часов после заявки</div>
          <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Вы получаете не презентацию, а рабочую карту потерь.</h2>
          <p className="text-lg leading-relaxed text-[#8BA89E]">Первый результат должен быть полезен до внедрения: показать деньги, риск, блокер, доказательство и следующий шаг.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {items.map(([title, text], index) => (
            <div key={title} className="premium-card rounded-2xl p-6 transition hover:-translate-y-1">
              <div className="mb-5 font-mono text-xs text-mint">48:{String(index + 1).padStart(2, '0')}</div>
              <h3 className="mb-3 text-lg font-black text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-[#8BA89E]">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
