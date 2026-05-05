const heroFeatures = [
  ['01', 'Сделка', 'цена, партия, стороны'],
  ['02', 'Рейс', 'машина, маршрут'],
  ['03', 'Приёмка', 'вес, качество'],
  ['04', 'Деньги', 'выпуск, удержание'],
];

const eventRows = [
  ['Лот', 'ставка принята', 'цена и объём зафиксированы'],
  ['Логистика', 'рейс назначен', 'водитель, машина и маршрут видны'],
  ['Приёмка', 'есть расхождение', 'качество требует подтверждения'],
  ['Оплата', 'часть удержана', 'есть основание и следующий шаг'],
];

const moneySignals = [
  ['к выпуску', '2 711 520 ₽'],
  ['удержано', '1 162 080 ₽'],
  ['блокер', 'качество + документы'],
];

export default function LandingHero() {
  return (
    <section id="top" className="landing-hero lux-line relative min-h-screen scroll-mt-28 pt-[92px] grid-bg">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="hero-scanline" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_72%_52%_at_50%_0%,rgba(10,122,95,0.26),transparent_72%)]" />

      <div className="landing-hero-inner relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-5 pb-20 pt-10 md:px-6 md:pt-14 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="reveal">
          <div className="mx-auto max-w-3xl text-center lg:mx-0 lg:text-left">
            <div className="hero-kicker mb-7 inline-flex rounded-full border border-[rgba(126,242,196,0.18)] bg-[rgba(126,242,196,0.055)] px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] text-mint shadow-[0_0_42px_rgba(126,242,196,0.08)] md:text-xs">
              сделка · деньги · доказательства
            </div>
            <h1 className="hero-title text-5xl font-black leading-[0.94] tracking-[-0.06em] text-white sm:text-6xl md:text-8xl">
              Деньги видны<br />
              <span className="gradient-text">до последнего шага</span>
            </h1>
            <p className="hero-subtitle mx-auto mt-6 max-w-2xl text-xl font-semibold leading-relaxed text-[#C9D8D2] md:text-2xl lg:mx-0">
              Цена, рейс, приёмка, документы, удержание и выпуск средств — в одной проверяемой цепочке.
            </p>
          </div>

          <div className="hero-feature-grid reveal reveal-delay-1 mt-9 grid grid-cols-2 gap-3">
            {heroFeatures.map(([icon, title, text]) => (
              <div key={title} className="hero-feature-card motion-lift rounded-[22px] border border-[rgba(126,242,196,0.14)] bg-[rgba(255,255,255,0.035)] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.20)] md:p-5">
                <div className="hero-feature-number mb-4 flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(126,242,196,0.18)] bg-[rgba(126,242,196,0.08)] font-mono text-xs font-black text-mint">{icon}</div>
                <div className="hero-feature-title text-base font-black leading-tight text-white md:text-lg">{title}</div>
                <div className="hero-feature-text mt-1 text-sm leading-snug text-[#8BA89E]">{text}</div>
              </div>
            ))}
          </div>

          <div className="hero-principle reveal reveal-delay-2 mt-6 rounded-[24px] border border-[rgba(126,242,196,0.14)] bg-[#07110E]/78 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[rgba(126,242,196,0.20)] bg-[rgba(126,242,196,0.08)] text-xl font-black text-mint">✓</div>
              <div className="text-lg leading-relaxed text-[#C9D8D2]">Главный принцип:<br /><span className="font-black text-mint">деньги двигаются только по подтверждённым фактам.</span></div>
            </div>
          </div>

          <div className="reveal reveal-delay-3 mt-8 hidden flex-col gap-4 sm:flex-row md:flex">
            <a href="#interest" className="lux-button rounded-xl bg-brand px-8 py-4 text-center font-bold text-white glow transition hover:scale-[1.02] hover:bg-brand-hover">Пройти мини-чат</a>
            <a href="#loss-map" className="rounded-xl border border-[rgba(126,242,196,0.2)] bg-[rgba(255,255,255,0.02)] px-8 py-4 text-center font-semibold text-[#EAF1EE] transition hover:border-[rgba(126,242,196,0.4)]">Где теряются деньги</a>
          </div>

          <p className="hero-note reveal reveal-delay-3 mt-6 max-w-2xl text-xs leading-relaxed text-[#6F8C82]">
            Предпилотный контур. Боевые подключения к банкам, ФГИС «Зерно», СДИЗ и ЭДО требуют договоров, доступов и проверки в контролируемом пилоте.
          </p>
        </div>

        <div className="reveal reveal-delay-2 hidden premium-panel hero-product-card rounded-[34px] p-4 shadow-[0_42px_140px_rgba(0,0,0,0.48)] lg:block">
          <div className="rounded-[28px] border border-[rgba(126,242,196,0.08)] bg-[#07110E]/95 p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(126,242,196,0.08)] pb-5">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#4A6B5E]">пример одной сделки</div>
                <div className="mt-2 text-2xl font-black text-white">DL-9102 · пшеница 4 класса</div>
                <div className="mt-2 text-sm text-[#6F8C82]">240 т · 3 873 600 ₽ · Тамбовская область</div>
              </div>
              <span className="rounded-full border border-[rgba(255,139,144,0.24)] bg-[rgba(255,139,144,0.075)] px-3 py-1 text-xs font-semibold text-[#FF8B90]">есть удержание</span>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {moneySignals.map(([label, value]) => (
                <div key={label} className="money-tile rounded-2xl border border-[rgba(126,242,196,0.1)] bg-[rgba(126,242,196,0.035)] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[#6F8C82]">{label}</div>
                  <div className="mt-1 font-mono text-base font-black text-white">{value}</div>
                </div>
              ))}
            </div>

            <div id="how" className="mt-5 space-y-2.5 scroll-mt-28">
              {eventRows.map(([title, status, text], index) => (
                <div key={title} className="flow-dot motion-slide flex gap-3 rounded-xl border border-[rgba(126,242,196,0.07)] bg-[#111C19] px-4 py-3 transition hover:translate-x-1 hover:border-[rgba(126,242,196,0.22)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(126,242,196,0.08)] font-mono text-xs text-mint">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">{title}</span>
                      <span className="text-xs font-semibold text-[#F5B41E]">{status}</span>
                    </div>
                    <div className="mt-1 text-xs text-[#8BA89E]">{text}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-[rgba(245,180,30,0.18)] bg-[rgba(245,180,30,0.06)] p-4 text-sm leading-relaxed text-[#D7C895]">
              Решение: выпустить подтверждённую часть, удержать спорную часть до закрытия качества и документов.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
