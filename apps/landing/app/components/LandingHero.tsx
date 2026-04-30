const route = ['условия', 'партия', 'рейс', 'приёмка', 'документы', 'расчёт', 'спор'];

const money = [
  ['резерв', '3,8 млн ₽'],
  ['удержание', '180 тыс. ₽'],
  ['к выпуску', '70%'],
];

export default function LandingHero() {
  return (
    <section id="top" className="lux-line relative min-h-screen pt-28 grid-bg">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_0%,rgba(10,122,95,0.26),transparent_72%)]" />
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-14 lg:grid-cols-[1fr_1fr]">
        <div>
          <div className="reveal mb-7 inline-flex items-center gap-2 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_18px_rgba(126,242,196,0.8)]" />
            <span className="text-xs font-semibold uppercase tracking-wide text-mint">controlled pilot для зерновой сделки</span>
          </div>
          <h1 className="reveal reveal-delay-1 mb-6 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight md:text-7xl">
            Цена договорена.<br />
            <span className="gradient-text">Деньги ещё не защищены.</span>
          </h1>
          <p className="reveal reveal-delay-2 mb-8 max-w-2xl text-lg leading-relaxed text-[#A7BBB4] md:text-xl">
            Цифровой контур исполнения внебиржевой зерновой сделки: условия, логистика, приёмка, документы, деньги, спор и доказательства.
          </p>
          <p className="reveal reveal-delay-2 mb-10 max-w-2xl text-sm leading-relaxed text-[#6F8C82]">
            Не биржа и не доска объявлений. Стороны могут договориться о цене где угодно. Ценность начинается там, где сделку нужно довести до денег без хаоса.
          </p>
          <div className="reveal reveal-delay-3 flex flex-col gap-4 sm:flex-row">
            <a href="#contact" className="lux-button rounded-xl bg-brand px-8 py-4 text-center font-semibold text-white glow transition hover:scale-[1.02] hover:bg-brand-hover">Оставить заявку на пилот</a>
            <a href="#mockup" className="rounded-xl border border-[rgba(126,242,196,0.2)] bg-[rgba(255,255,255,0.02)] px-8 py-4 text-center font-medium text-[#EAF1EE] transition hover:border-[rgba(126,242,196,0.4)]">Посмотреть контур</a>
          </div>
        </div>

        <div className="reveal reveal-delay-2 premium-panel rounded-[34px] p-4 shadow-[0_42px_140px_rgba(0,0,0,0.48)]">
          <div className="rounded-[28px] border border-[rgba(126,242,196,0.08)] bg-[#07110E]/95 p-5">
            <div className="mb-5 flex items-start justify-between gap-4 border-b border-[rgba(126,242,196,0.08)] pb-5">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#4A6B5E]">центр сделки</div>
                <div className="mt-2 text-xl font-black text-white">DL-9102 · пшеница 4 класса</div>
              </div>
              <span className="rounded-full border border-[rgba(245,180,30,0.22)] bg-[rgba(245,180,30,0.07)] px-3 py-1 text-xs font-semibold text-[#F5B41E]">риск удержания</span>
            </div>
            <div className="space-y-2.5">
              {route.map((item, index) => (
                <div key={item} className="flow-dot flex items-center gap-3 rounded-xl border border-[rgba(126,242,196,0.07)] bg-[#111C19] px-4 py-3 transition hover:translate-x-1 hover:border-[rgba(126,242,196,0.22)]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[rgba(126,242,196,0.08)] font-mono text-xs text-mint">{index + 1}</span>
                  <span className="text-sm text-[#C9D8D2]">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {money.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[rgba(126,242,196,0.1)] bg-[rgba(126,242,196,0.035)] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[#6F8C82]">{label}</div>
                  <div className="mt-1 font-mono text-xl font-bold text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
