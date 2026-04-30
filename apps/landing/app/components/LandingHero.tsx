const dealFlow = ['лот', 'перевозка', 'элеватор', 'лаборатория', 'документы', 'спор', 'деньги'];

const executionRails = [
  [
    '01',
    'Деньги',
    'Сбер · Безопасные сделки',
    'номинальный счёт · резерв · release · возврат',
    'API-логика удержаний и выпусков средств подключается к статусам сделки. Боевой контур — после договора, доступов и тестового стенда.',
  ],
  [
    '02',
    'Логистика',
    'СберКорус · Сфера Перевозки',
    'ЭТрН · заявка · экспедитор · API',
    'ЭПД и перевозочные документы встраиваются в маршрут рейса: погрузка, перевозчик, элеватор, приёмка.',
  ],
  [
    '03',
    'Финансирование',
    'B2B-кредит для покупателя',
    'виджет · лимит от 100 тыс. ₽ · СберБизнес',
    'Кредитный сценарий помогает покупателю закрыть закупку, если он проходит банковские условия и подключённый путь.',
  ],
  [
    '04',
    'AI-контур',
    'GigaChat Enterprise / агентный ИИ',
    'риски · документы · сравнение · спор',
    'ИИ ускоряет анализ сделки, документов и расхождений, но не заменяет банк, лабораторию, ЭДО или правовое решение.',
  ],
];

const executionStrip = ['цена', 'резерв', 'рейс / ЭТрН', 'приёмка / лаборатория', 'документы', 'release денег', 'спор / доказательства'];

const eventRows = [
  ['Рейс', 'подтверждён', 'водитель · маршрут · ETA'],
  ['Вес', 'принят', '240 т · сверка с отгрузкой'],
  ['Качество', 'расхождение', 'лаборатория требует акцепта'],
  ['ЭДО / ЭПД', 'ожидает пакет', 'подпись и транспортный комплект'],
];

const aiSignals = [
  ['AI-риск', 'качество + ЭДО'],
  ['к выпуску', '2 711 520 ₽'],
  ['удержано', '1 162 080 ₽'],
];

export default function LandingHero() {
  return (
    <section id="top" className="lux-line relative min-h-screen pt-24 grid-bg">
      <div className="orb orb-a" />
      <div className="orb orb-b" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_72%_52%_at_50%_0%,rgba(10,122,95,0.26),transparent_72%)]" />
      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-16 lg:grid-cols-[0.92fr_1.08fr]">
        <div>
          <div className="reveal mb-10 max-w-4xl">
            <div className="relative overflow-hidden rounded-[34px] border border-[rgba(126,242,196,0.16)] bg-[linear-gradient(135deg,rgba(126,242,196,0.11),rgba(255,255,255,0.025)_46%,rgba(10,122,95,0.09))] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.34)] md:p-8">
              <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[rgba(126,242,196,0.13)] blur-3xl" />
              <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(126,242,196,0.45)] to-transparent" />
              <div className="relative">
                <div className="mb-5 flex justify-center">
                  <div className="inline-flex rounded-full border border-[rgba(126,242,196,0.22)] bg-[#07110E]/80 px-4 py-1.5 text-center text-[10px] font-black uppercase tracking-[0.24em] text-mint shadow-[0_0_42px_rgba(126,242,196,0.08)] md:text-xs">
                    не маркетплейс · не доска объявлений
                  </div>
                </div>

                <h1 className="text-center text-6xl font-black leading-[0.94] tracking-[-0.065em] text-white md:text-8xl">
                  Прозрачная <span className="gradient-text">Цена</span>
                </h1>

                <p className="mx-auto mt-5 max-w-2xl text-center text-lg font-semibold leading-relaxed text-[#C9D8D2] md:text-2xl">
                  Контур исполнения зерновой сделки
                </p>

                <div className="mx-auto mt-7 max-w-3xl rounded-2xl border border-[rgba(126,242,196,0.1)] bg-[#07110E]/70 p-3 md:p-4">
                  <div className="mb-3 text-center text-[10px] font-black uppercase tracking-[0.24em] text-[#6F8C82]">
                    лот → исполнение → доказательства → деньги
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {dealFlow.map((step, index) => (
                      <span key={step} className="inline-flex items-center gap-2">
                        <span className="rounded-full border border-[rgba(126,242,196,0.14)] bg-[rgba(126,242,196,0.055)] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-[#EAF1EE]">
                          {step}
                        </span>
                        {index < dealFlow.length - 1 ? <span className="hidden text-[#4A6B5E] sm:inline">→</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="reveal reveal-delay-1 mb-8 max-w-4xl">
            <div className="relative overflow-hidden rounded-[28px] border border-[rgba(126,242,196,0.12)] bg-[#07110E]/78 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.28)] md:p-5">
              <div className="pointer-events-none absolute -left-16 -top-20 h-44 w-44 rounded-full bg-[rgba(126,242,196,0.10)] blur-3xl" />
              <div className="pointer-events-none absolute bottom-0 right-0 h-32 w-64 bg-[radial-gradient(circle_at_80%_100%,rgba(245,180,30,0.12),transparent_64%)]" />

              <div className="relative mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.24em] text-mint">банковый · документный · AI-контур</div>
                  <div className="mt-2 text-xl font-black tracking-[-0.03em] text-white md:text-2xl">Встроено в сделку, а не вынесено рядом</div>
                </div>
                <div className="max-w-md text-sm leading-relaxed text-[#8BA89E]">
                  Сбер, СберКорус и AI показаны как совместимые рельсы controlled pilot: деньги, ЭДО, кредит и анализ риска привязаны к событиям сделки.
                </div>
              </div>

              <div className="relative grid gap-3 md:grid-cols-2">
                {executionRails.map(([number, label, title, meta, text]) => (
                  <div key={title} className="group rounded-2xl border border-[rgba(126,242,196,0.11)] bg-[linear-gradient(135deg,rgba(126,242,196,0.06),rgba(255,255,255,0.025))] p-4 transition hover:-translate-y-0.5 hover:border-[rgba(126,242,196,0.25)]">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="font-mono text-xs font-black text-mint">{number}</span>
                      <span className="rounded-full bg-[rgba(126,242,196,0.08)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#A7BBB4]">{label}</span>
                    </div>
                    <div className="text-base font-black text-white md:text-lg">{title}</div>
                    <div className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-mint/85">{meta}</div>
                    <p className="mt-3 text-sm leading-relaxed text-[#8BA89E]">{text}</p>
                  </div>
                ))}
              </div>

              <div className="relative mt-4 rounded-2xl border border-[rgba(126,242,196,0.09)] bg-black/20 p-3">
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-[#6F8C82]">сквозной маршрут</div>
                <div className="flex flex-wrap items-center gap-2">
                  {executionStrip.map((step, index) => (
                    <span key={step} className="inline-flex items-center gap-2">
                      <span className="rounded-lg bg-[rgba(255,255,255,0.045)] px-2.5 py-1 text-xs font-semibold text-[#DDE8E3]">{step}</span>
                      {index < executionStrip.length - 1 ? <span className="text-[#35584C]">→</span> : null}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="reveal reveal-delay-1 mb-6 max-w-4xl text-3xl font-black leading-[1.08] tracking-tight text-white md:text-5xl">
            Цена согласована.<br />
            <span className="gradient-text">Теперь сделку нужно довести до денег.</span>
          </div>
          <p className="reveal reveal-delay-2 mb-8 max-w-2xl text-lg leading-relaxed text-[#A7BBB4] md:text-xl">
            «Прозрачная Цена» показывает, где в зерновой сделке зависают деньги после цены: рейс, вес, качество, СДИЗ, ЭДО, удержания, оплата и спор.
          </p>
          <div className="reveal reveal-delay-3 flex flex-col gap-4 sm:flex-row">
            <a href="#contact" className="lux-button rounded-xl bg-brand px-8 py-4 text-center font-semibold text-white glow transition hover:scale-[1.02] hover:bg-brand-hover">Получить карту потерь сделки</a>
            <a href="#sample" className="rounded-xl border border-[rgba(126,242,196,0.2)] bg-[rgba(255,255,255,0.02)] px-8 py-4 text-center font-medium text-[#EAF1EE] transition hover:border-[rgba(126,242,196,0.4)]">Показать пример</a>
          </div>
          <p className="reveal reveal-delay-3 mt-6 max-w-2xl text-xs leading-relaxed text-[#6F8C82]">
            Сбер, СберКорус, AI и Минсельхоз указаны как логика совместимости и отраслевой контекст. Боевые подключения — только через договор, доступы и проверку на controlled pilot.
          </p>
        </div>

        <div className="reveal reveal-delay-2 premium-panel hero-product-card rounded-[34px] p-4 shadow-[0_42px_140px_rgba(0,0,0,0.48)]">
          <div className="rounded-[28px] border border-[rgba(126,242,196,0.08)] bg-[#07110E]/95 p-5">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(126,242,196,0.08)] pb-5">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#4A6B5E]">контур исполнения сделки</div>
                <div className="mt-2 text-2xl font-black text-white">DL-9102 · пшеница 4 класса</div>
                <div className="mt-2 text-sm text-[#6F8C82]">240 т · 3 873 600 ₽ · Тамбовская область</div>
              </div>
              <span className="rounded-full border border-[rgba(255,139,144,0.24)] bg-[rgba(255,139,144,0.075)] px-3 py-1 text-xs font-semibold text-[#FF8B90]">деньги под риском</span>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {aiSignals.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-[rgba(126,242,196,0.1)] bg-[rgba(126,242,196,0.035)] p-4">
                  <div className="text-xs uppercase tracking-[0.14em] text-[#6F8C82]">{label}</div>
                  <div className="mt-1 font-mono text-base font-black text-white">{value}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2.5">
              {eventRows.map(([title, status, text], index) => (
                <div key={title} className="flow-dot flex gap-3 rounded-xl border border-[rgba(126,242,196,0.07)] bg-[#111C19] px-4 py-3 transition hover:translate-x-1 hover:border-[rgba(126,242,196,0.22)]">
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

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
              <div className="rounded-2xl border border-[rgba(245,180,30,0.18)] bg-[rgba(245,180,30,0.06)] p-4 text-sm leading-relaxed text-[#D7C895]">
                AI-подсказка: выпустить 70% после сверки веса; удержать 30% до акцепта лаборатории и закрытия ЭПД/ЭДО.
              </div>
              <a href="#contact" className="lux-button flex items-center justify-center rounded-2xl bg-brand px-5 py-4 text-sm font-black text-white hover:bg-brand-hover">Выпустить 70%</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
