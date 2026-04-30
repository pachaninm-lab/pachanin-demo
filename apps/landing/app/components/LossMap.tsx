const losses = [
  ['Цена', 'условия ушли в переписку', 'разброс цены может съесть маржу ещё до рейса'],
  ['Рейс', 'машина задержалась, сменилась или ушла с маршрута', 'появляется спор по срокам, простою и ответственности'],
  ['Вес', 'недовес стал предметом торга', 'финальная сумма меняется без единого основания'],
  ['Качество', 'влага, сорность, натура или класс не совпали', 'возникает качественная дельта и удержание'],
  ['СДИЗ', 'государственный след не закрыт вовремя', 'расчёт тормозится до подтверждения партии'],
  ['ЭДО', 'подпись ждёт не тот участник', 'деньги зависают из-за неполного пакета'],
  ['Оплата', 'удержание сделано без ясного основания', 'стороны спорят уже после поставки'],
  ['Спор', 'нет единого пакета фактов', 'доказательства собираются задним числом'],
];

export default function LossMap() {
  return (
    <section id="loss-map" className="lux-line relative z-10 py-24 grid-bg">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 max-w-3xl">
          <div className="mb-5 inline-flex rounded-full border border-[rgba(255,139,144,0.24)] bg-[rgba(255,139,144,0.05)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#FF8B90]">карта потерь сделки</div>
          <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Где в зерновой сделке исчезают деньги.</h2>
          <p className="text-lg leading-relaxed text-[#8BA89E]">Цена — только начало. Деньги уходят там, где нет единого контроля исполнения, документов, качества, маршрута и основания для расчёта.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {losses.map(([title, text, effect], index) => (
            <div key={title} className="premium-card rounded-2xl p-5 transition hover:-translate-y-1">
              <div className="mb-5 flex items-center justify-between">
                <span className="font-mono text-xs text-[#4A6B5E]">{String(index + 1).padStart(2, '0')}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF8B90] shadow-[0_0_18px_rgba(255,139,144,0.7)]" />
              </div>
              <h3 className="mb-2 text-lg font-black text-white">{title}</h3>
              <p className="mb-4 text-sm leading-relaxed text-[#8BA89E]">{text}</p>
              <p className="border-t border-[rgba(126,242,196,0.08)] pt-4 text-xs leading-relaxed text-[#6F8C82]">{effect}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
