const scenarios = [
  ['Рейс приехал, вес не сошёлся', 'Продавец спорит, покупатель удерживает, элеватор показывает свою цифру.', 'Собрать вес, маршрут, акт, ответственного и основание удержания.'],
  ['Лаборатория дала другое качество', 'Цена была согласована на одно качество, расчёт хотят делать по другому.', 'Связать протокол, допуск, акцепт качества и сумму под риском.'],
  ['ЭДО не закрыт — деньги зависли', 'Зерно физически принято, но выпуск денег не проходит из-за пакета документов.', 'Показать, чья подпись, какой документ и какой следующий шаг.'],
  ['Спор собирают задним числом', 'Фото, маршрут, лаборатория и переписка лежат отдельно, доказательств не хватает.', 'Собрать единый след сделки до того, как спор стал дорогим.'],
];

export default function AgroScenarios() {
  return (
    <section id="agro-scenarios" className="lux-line relative z-10 py-24 grid-bg">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 max-w-3xl">
          <div className="mb-5 inline-flex rounded-full border border-[rgba(255,139,144,0.24)] bg-[rgba(255,139,144,0.05)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#FF8B90]">язык реального АПК</div>
          <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Проблема не в цифровизации. Проблема в конкретной потере денег.</h2>
          <p className="text-lg leading-relaxed text-[#8BA89E]">Лендинг должен говорить не как стартап, а как человек, который видел сделку после цены.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {scenarios.map(([title, pain, action]) => (
            <div key={title} className="premium-card rounded-2xl p-6 transition hover:-translate-y-1">
              <h3 className="mb-3 text-xl font-black text-white">{title}</h3>
              <p className="mb-4 text-sm leading-relaxed text-[#8BA89E]">{pain}</p>
              <p className="border-t border-[rgba(126,242,196,0.08)] pt-4 text-sm font-semibold leading-relaxed text-[#C9D8D2]">Что делает контур: {action}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
