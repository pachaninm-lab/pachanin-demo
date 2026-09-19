export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden grid-bg">
      {/* Radial glow background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(10,122,95,0.25) 0%, transparent 70%)',
        }}
      />
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(126,242,196,0.06) 0%, transparent 70%)',
        }}
      />

      <div className="relative max-w-7xl mx-auto px-6 text-center py-24">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />
          <span className="text-xs font-medium text-mint tracking-wide uppercase">
            Пилот · Тамбовская область
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight mb-6 text-balance">
          Зерновая сделка —<br />
          <span className="gradient-text">от цены до денег</span>
          <br />
          в одном контуре
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-[#8BA89E] max-w-2xl mx-auto mb-10 leading-relaxed">
          Прозрачная Цена — не витрина объявлений, а цифровой контур исполнения
          внебиржевой сделки. Логистика, приёмка, документы, банк и споры
          — всё в одной системе, ничего в мессенджерах.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <a
            href="#cta"
            className="px-8 py-4 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-base transition-all glow hover:scale-[1.02] w-full sm:w-auto"
          >
            Запросить демо-доступ
          </a>
          <a
            href="#how-it-works"
            className="px-8 py-4 rounded-xl border border-[rgba(126,242,196,0.2)] hover:border-[rgba(126,242,196,0.4)] text-[#EAF1EE] font-medium text-base transition-all w-full sm:w-auto"
          >
            Как работает платформа →
          </a>
        </div>

        {/* Dashboard mockup */}
        <div className="relative max-w-5xl mx-auto">
          <div className="card-glass rounded-2xl p-1 glow">
            {/* Fake browser bar */}
            <div className="bg-[#0B1513] rounded-t-xl px-4 py-3 flex items-center gap-2 border-b border-[rgba(126,242,196,0.08)]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#FF8B90] opacity-60" />
                <div className="w-3 h-3 rounded-full bg-[#F5B41E] opacity-60" />
                <div className="w-3 h-3 rounded-full bg-[#7EF2C4] opacity-60" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-[rgba(126,242,196,0.06)] rounded-md px-3 py-1 text-xs font-mono text-[#4A6B5E] text-center w-fit mx-auto">
                  app.prozprice.ru/platform-v7/control-tower
                </div>
              </div>
            </div>

            {/* Dashboard content */}
            <div className="bg-[#0B1513] rounded-b-xl p-6">
              {/* Top KPI row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Сделок активно', value: '31', trend: '+4', color: 'text-mint' },
                  { label: 'Объём (₽)', value: '118М', trend: '+30%', color: 'text-mint' },
                  { label: 'Средний цикл', value: '8.3 дн', trend: '−0.5', color: 'text-mint' },
                  { label: 'Комиссия платформы', value: '1.8%', trend: '', color: 'text-[#F5B41E]' },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-[#111C19] rounded-xl p-3 border border-[rgba(126,242,196,0.07)]">
                    <div className="text-xs text-[#4A6B5E] mb-1">{kpi.label}</div>
                    <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
                    {kpi.trend && (
                      <div className="text-xs text-mint opacity-70 mt-0.5">{kpi.trend} vs пред.</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Deals table preview */}
              <div className="bg-[#111C19] rounded-xl border border-[rgba(126,242,196,0.07)] overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[rgba(126,242,196,0.07)] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#EAF1EE]">Активные сделки</span>
                  <span className="text-xs text-[#4A6B5E]">31 / 31</span>
                </div>
                <div className="divide-y divide-[rgba(126,242,196,0.04)]">
                  {[
                    { id: 'DL-9102', culture: 'Пшеница 3 кл.', volume: '250 т', sum: '7.25М ₽', status: 'ЛОГИСТИКА', color: 'bg-[#F5B41E]' },
                    { id: 'DL-9089', culture: 'Ячмень', volume: '180 т', sum: '4.86М ₽', status: 'ЛАБОРАТОРИЯ', color: 'bg-brand' },
                    { id: 'DL-9067', culture: 'Кукуруза', volume: '320 т', sum: '9.92М ₽', status: 'ДОКУМЕНТЫ', color: 'bg-[#14B8A6]' },
                    { id: 'DL-9041', culture: 'Подсолнечник', volume: '90 т', sum: '5.40М ₽', status: 'ЗАВЕРШЕНО', color: 'bg-[#16A34A]' },
                  ].map((deal) => (
                    <div key={deal.id} className="px-4 py-2.5 flex items-center gap-4 text-xs hover:bg-[rgba(126,242,196,0.02)]">
                      <span className="font-mono text-[#4A6B5E] w-16 shrink-0">{deal.id}</span>
                      <span className="text-[#8BA89E] flex-1">{deal.culture}</span>
                      <span className="text-[#8BA89E] w-16 text-right hidden md:block">{deal.volume}</span>
                      <span className="text-[#EAF1EE] w-20 text-right font-medium">{deal.sum}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${deal.color} w-24 text-center hidden sm:block`}>
                        {deal.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating badges */}
          <div className="absolute -left-4 top-1/3 hidden lg:block">
            <div className="card-glass rounded-xl px-4 py-3 text-xs">
              <div className="text-[#4A6B5E] mb-1">ФГИС · Синхронизация</div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-mint" />
                <span className="text-mint font-semibold">100% покрытие</span>
              </div>
            </div>
          </div>
          <div className="absolute -right-4 top-1/4 hidden lg:block">
            <div className="card-glass rounded-xl px-4 py-3 text-xs">
              <div className="text-[#4A6B5E] mb-1">Споры</div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                <span className="text-[#EAF1EE] font-semibold">Просрочек: 0%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
