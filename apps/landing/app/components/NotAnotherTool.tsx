const items = [
  ['Excel', 'хранит строки, но не держит юридически значимый маршрут сделки, владельцев действий и денежные основания'],
  ['WhatsApp', 'быстрый до первого спора, но не даёт версии факта, полноты документов и управляемого расчёта'],
  ['Маркетплейс', 'может помочь с ценой и контактом, но не ведёт исполнение до приёмки, документов и денег'],
  ['CRM', 'видит клиента, но не видит рейс, лабораторию, СДИЗ, ЭДО, удержания и доказательства'],
];

export default function NotAnotherTool() {
  return (
    <section className="relative z-10 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 max-w-3xl">
          <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-mint">не ещё один инструмент</div>
          <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Проблема не в том, что нет чата или таблицы.</h2>
          <p className="text-lg leading-relaxed text-[#8BA89E]">Проблема в том, что после цены нет одного места, где связаны партия, рейс, приёмка, качество, документы, деньги и спор.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {items.map(([title, text]) => (
            <div key={title} className="premium-card rounded-2xl p-6 transition hover:-translate-y-1">
              <h3 className="mb-3 text-lg font-black text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-[#8BA89E]">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-3xl border border-[rgba(126,242,196,0.12)] bg-[rgba(126,242,196,0.045)] p-6 text-lg font-semibold leading-relaxed text-[#C9D8D2]">
          «Прозрачная Цена» нужна там, где цена уже согласована, но деньги ещё зависят от исполнения.
        </div>
      </div>
    </section>
  );
}
