const losses = [
  ['Цена', 'условия не зафиксированы'],
  ['Рейс', 'машина опоздала или сменилась'],
  ['Вес', 'появился недовес'],
  ['Качество', 'лаборатория дала расхождение'],
  ['СДИЗ', 'документ не закрыт'],
  ['ЭДО', 'нет подписи или пакета'],
  ['Оплата', 'деньги удержаны'],
  ['Спор', 'нет единого пакета фактов'],
];

export default function LossMap() {
  return (
    <section id="loss-map" className="lux-line relative z-10 py-20 grid-bg md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 max-w-3xl">
          <div className="mb-5 inline-flex rounded-full border border-[rgba(255,139,144,0.24)] bg-[rgba(255,139,144,0.05)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#FF8B90]">карта потерь</div>
          <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Вот где сделка начинает терять деньги.</h2>
          <p className="text-lg leading-relaxed text-[#8BA89E]">Пользователь сразу видит цепочку: от цены и рейса до документов, оплаты и спора. Без сложных терминов и лишних экранов.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {losses.map(([title, text], index) => (
            <div key={title} className="premium-card rounded-2xl p-5 transition hover:-translate-y-1">
              <div className="mb-5 flex items-center justify-between">
                <span className="font-mono text-xs text-[#4A6B5E]">{String(index + 1).padStart(2, '0')}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF8B90] shadow-[0_0_18px_rgba(255,139,144,0.7)]" />
              </div>
              <h3 className="mb-2 text-lg font-black text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-[#8BA89E]">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
