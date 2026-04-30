const scope = ['1 сделка', '1 партия', '1 маршрут', '1 точка приёмки', '1 пакет документов', '1 сценарий оплаты', '1 спорный риск'];

const results = [
  ['Карта потерь', 'где деньги могут зависнуть и почему'],
  ['Матрица блокеров', 'кто держит следующий шаг и какой факт нужен'],
  ['Контур данных', 'какие поля нужны для банка, ЭДО, ФГИС и оператора'],
  ['План пилота', 'что проверяем сначала, а что не обещаем без доступа'],
];

export default function PilotSingleDeal() {
  return (
    <section id="pilot" className="lux-line relative z-10 py-24 grid-bg">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <div className="mb-5 inline-flex rounded-full border border-[rgba(245,180,30,0.24)] bg-[rgba(245,180,30,0.06)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F5B41E]">пилот на одной сделке</div>
          <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Сначала не масштаб. Сначала одна сделка, которую нельзя потерять.</h2>
          <p className="text-lg leading-relaxed text-[#8BA89E]">Проверяем не презентацию, а реальную цепочку: где риск, кто отвечает, какие документы тормозят расчёт и почему деньги нельзя выпускать вслепую.</p>
        </div>
        <div className="premium-panel rounded-3xl p-6">
          <div className="grid gap-3 md:grid-cols-2">
            {scope.map((item, index) => (
              <div key={item} className="flow-dot rounded-xl border border-[rgba(126,242,196,0.07)] bg-[#111C19] p-4 pr-10">
                <span className="font-mono text-xs text-mint">{index + 1}</span>
                <div className="mt-2 text-sm font-bold text-[#C9D8D2]">{item}</div>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-[rgba(126,242,196,0.1)] bg-[rgba(126,242,196,0.045)] p-5">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#6F8C82]">результат первого разбора</div>
            <div className="grid gap-3 md:grid-cols-2">
              {results.map(([title, text]) => (
                <div key={title} className="rounded-xl border border-[rgba(126,242,196,0.08)] bg-[#0B1513] p-4">
                  <div className="text-sm font-bold text-white">{title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-[#8BA89E]">{text}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-[rgba(245,180,30,0.18)] bg-[rgba(245,180,30,0.06)] p-4 text-sm leading-relaxed text-[#D7C895]">ФГИС «Зерно», СДИЗ, ЭДО, ЭТрН, банк и 1С не заявляются как завершённые без доступа, договора и проверки.</div>
        </div>
      </div>
    </section>
  );
}
