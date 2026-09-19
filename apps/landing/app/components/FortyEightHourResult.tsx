const items = [
  ['Где деньги', 'какая сумма готова к оплате, а какая должна быть удержана'],
  ['Что мешает оплате', 'вес, качество, документы, СДИЗ, ЭДО, рейс или спор'],
  ['Каких фактов не хватает', 'фото, акт, лаборатория, маршрут, подпись или история действий'],
  ['Что делать дальше', 'один понятный пилотный сценарий без лишних внедрений'],
];

export default function FortyEightHourResult() {
  return (
    <section id="48h" className="relative z-10 py-20 md:py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 max-w-3xl">
          <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-mint">первый результат</div>
          <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">За 48 часов — понятная карта одной сделки.</h2>
          <p className="text-lg leading-relaxed text-[#8BA89E]">Без длинного внедрения. Берём одну реальную сделку и показываем, где зависают деньги, кто отвечает и какие факты нужны для оплаты.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {items.map(([title, text], index) => (
            <div key={title} className="premium-card rounded-2xl p-6 transition hover:-translate-y-1">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(126,242,196,0.16)] bg-[rgba(126,242,196,0.065)] font-mono text-sm font-black text-mint">{index + 1}</div>
              <h3 className="mb-3 text-lg font-black text-white">{title}</h3>
              <p className="text-sm leading-relaxed text-[#8BA89E]">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
