const risks = [
  ['Качество', 'есть расхождение лаборатории', 'удержать спорную часть'],
  ['Документы', 'нет финального пакета', 'не выпускать остаток'],
  ['Деньги', 'нет основания полного release', 'частичный выпуск'],
  ['Доказательства', 'разрозненный след', 'собрать маршрут, вес, лабораторию, ЭДО'],
];

export default function SampleLossCard() {
  return (
    <section id="sample" className="relative z-10 py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-mint">пример результата</div>
          <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Так выглядит карта потерь сделки.</h2>
          <p className="text-lg leading-relaxed text-[#8BA89E]">До заявки человек должен понимать, что получит: не созвон, а структуру рисков, денег и следующего шага.</p>
          <a href="#contact" className="lux-button mt-8 inline-flex rounded-xl bg-brand px-7 py-4 font-semibold text-white">Получить такую карту</a>
        </div>
        <div className="premium-panel rounded-3xl p-6">
          <div className="mb-5 border-b border-[rgba(126,242,196,0.08)] pb-5">
            <div className="text-xs uppercase tracking-[0.18em] text-[#4A6B5E]">карта потерь</div>
            <div className="mt-2 text-xl font-black text-white">DL-9102 · 3 873 600 ₽</div>
          </div>
          <div className="space-y-3">
            {risks.map(([a,b,c]) => (
              <div key={a} className="rounded-2xl border border-[rgba(126,242,196,0.08)] bg-[#111C19] p-4">
                <div className="flex flex-wrap justify-between gap-2"><div className="font-bold text-white">{a}</div><div className="text-xs font-semibold text-[#F5B41E]">{b}</div></div>
                <div className="mt-2 text-sm text-[#8BA89E]">Что делать: {c}.</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
