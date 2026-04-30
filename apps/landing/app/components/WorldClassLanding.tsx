import PilotLeadForm from './PilotLeadForm';

const proofBadges = ['Сбер-контур', 'AI-анализ сделки', 'Минсельхоз: актуальность пилота', 'Controlled pilot'];

const dealEvents = [
  ['Рейс', 'подтверждён', 'водитель, маршрут, ETA'],
  ['Вес', 'принят', '240 т, сверка с отгрузкой'],
  ['Качество', 'расхождение', 'лаборатория требует акцепта'],
  ['ЭПД / ЭДО', 'ожидает пакет', 'подпись и транспортный комплект'],
  ['Деньги', 'частичный выпуск', '70% к выпуску, 30% под удержанием'],
];

const deliverables = [
  ['Карта потерь сделки', 'Где именно после цены возникают деньги под риском: рейс, вес, качество, документы, удержание или спор.'],
  ['Блокеры денег', 'Что мешает частичному или финальному выпуску средств и кто держит следующий шаг.'],
  ['Слабые места доказательств', 'Где нет достаточного следа: фото, маршрут, приёмка, лаборатория, ЭДО, СДИЗ или действия сторон.'],
  ['Следующий шаг', 'Что сделать первым, чтобы не потерять сделку и не вынести спор в бесконечную переписку.'],
];

const moneyRows = [
  ['Сумма сделки', '240 т x 16 140 ₽', '3 873 600 ₽'],
  ['К выпуску после подтверждений', '70%', '2 711 520 ₽'],
  ['Под удержанием до сверки', '30%', '1 162 080 ₽'],
  ['Комиссия платформы в модели', '0,15%', '5 810 ₽'],
];

const trust = [
  ['СберБизнес ID', 'Сценарий безопасного входа и регистрации компаний и ИП через продукт экосистемы Сбера.'],
  ['Безопасные сделки', 'Предынтеграционный сценарий API номинального счёта: резерв, событие сделки, выпуск, возврат и отчётность.'],
  ['СберКорус', 'Документный слой: ЭДО, ЭПД, МЧД и транспортный пакет как отдельный подключаемый контур.'],
  ['Оплата в кредит', 'B2B-кредитный виджет для покупателя как возможный финансовый сценарий после договора и доступа.'],
  ['AI-карта рисков', 'ИИ не принимает решение за стороны, а подсвечивает блокеры, документы, спорность и следующий шаг.'],
  ['Минсельхоз / регион', 'Проектная рамка соответствует цифровизации АПК; пилот в Тамбовской области заявлен как целесообразный в проектных материалах.'],
];

const pilotChain = ['продавец', 'покупатель', 'перевозчик', 'приёмка / элеватор', 'лаборатория', 'ЭДО / СДИЗ', 'банк'];

const sampleRisks = [
  ['Качество', 'есть расхождение лаборатории', 'удержать спорную часть до акцепта'],
  ['Документы', 'не закрыт транспортный пакет', 'не выпускать финальный остаток'],
  ['Деньги', 'нет основания для полного release', 'частичный выпуск после подтверждений'],
  ['Доказательства', 'нужен единый след событий', 'собрать маршрут, вес, лабораторию и ЭДО'],
];

function BrandMark() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0D7A5F] to-[#04261F] shadow-[0_0_22px_rgba(126,242,196,0.16)]">
      <span className="text-xs font-black tracking-tight text-[#9CFFD9]">ПЦ</span>
    </span>
  );
}

export default function WorldClassLanding() {
  return (
    <main className="premium-surface relative overflow-hidden bg-[#030D0A] text-[#EAF1EE]">
      <header className="premium-nav fixed inset-x-0 top-0 z-50 border-b border-[rgba(126,242,196,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <a href="#top" className="flex items-center gap-3" aria-label="Прозрачная Цена">
            <BrandMark />
            <span className="text-[15px] font-bold tracking-tight">Прозрачная <span className="text-mint">Цена</span></span>
          </a>
          <nav className="hidden items-center gap-6 md:flex">
            <a href="#result" className="text-sm text-[#8BA89E] hover:text-white">Результат</a>
            <a href="#money" className="text-sm text-[#8BA89E] hover:text-white">Деньги</a>
            <a href="#trust" className="text-sm text-[#8BA89E] hover:text-white">Сбер / AI / АПК</a>
            <a href="#pilot" className="text-sm text-[#8BA89E] hover:text-white">Пилот</a>
            <a href="#contact" className="lux-button rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-hover">Получить карту</a>
          </nav>
          <a href="#contact" className="lux-button rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white md:hidden">Карта</a>
        </div>
      </header>

      <section id="top" className="lux-line relative min-h-screen pt-28 grid-bg">
        <div className="orb orb-a" />
        <div className="orb orb-b" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_0%,rgba(10,122,95,0.24),transparent_72%)]" />
        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-14 lg:grid-cols-[0.96fr_1.04fr]">
          <div>
            <div className="reveal mb-6 flex flex-wrap gap-2">
              {proofBadges.map((item) => (
                <span key={item} className="rounded-full border border-[rgba(126,242,196,0.18)] bg-[rgba(126,242,196,0.055)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-mint">{item}</span>
              ))}
            </div>
            <h1 className="reveal reveal-delay-1 mb-6 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight md:text-7xl">
              После цены<br />
              <span className="gradient-text">деньги ещё не защищены.</span>
            </h1>
            <p className="reveal reveal-delay-2 mb-7 max-w-2xl text-lg leading-relaxed text-[#A7BBB4] md:text-xl">
              «Прозрачная Цена» — цифровой контур исполнения зерновой сделки: цена и допуск → логистика → приёмка → документы → деньги → спор → доказательства.
            </p>
            <p className="reveal reveal-delay-2 mb-10 max-w-2xl text-sm leading-relaxed text-[#6F8C82]">
              Упор на продукты экосистемы Сбера, AI-анализ рисков и практическую повестку цифровизации АПК. Без ложного статуса production-ready: боевые подключения требуют договоров, доступов и controlled pilot.
            </p>
            <div className="reveal reveal-delay-3 flex flex-col gap-4 sm:flex-row">
              <a href="#contact" className="lux-button rounded-xl bg-brand px-8 py-4 text-center font-semibold text-white glow hover:bg-brand-hover">Получить карту потерь сделки</a>
              <a href="#sample" className="rounded-xl border border-[rgba(126,242,196,0.2)] bg-[rgba(255,255,255,0.02)] px-8 py-4 text-center font-medium text-[#EAF1EE] hover:border-[rgba(126,242,196,0.4)]">Посмотреть пример</a>
            </div>
          </div>

          <div className="reveal reveal-delay-2 premium-panel rounded-[34px] p-5 shadow-[0_42px_140px_rgba(0,0,0,0.48)]">
            <div className="rounded-[28px] bg-[#07110E]/95 p-5">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-[rgba(126,242,196,0.08)] pb-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[#4A6B5E]">живой экран сделки</div>
                  <div className="mt-2 text-2xl font-black text-white">DL-9102 · пшеница 4 класса</div>
                  <div className="mt-2 text-sm text-[#6F8C82]">240 т · 3 873 600 ₽ · Тамбовская область</div>
                </div>
                <span className="rounded-full border border-[rgba(255,139,144,0.22)] bg-[rgba(255,139,144,0.07)] px-3 py-1 text-xs font-semibold text-[#FF8B90]">деньги под риском</span>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {moneyRows.slice(1, 4).map(([label, mid, value]) => (
                  <div key={label} className="rounded-2xl border border-[rgba(126,242,196,0.1)] bg-[rgba(126,242,196,0.035)] p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-[#6F8C82]">{label}</div>
                    <div className="mt-1 font-mono text-lg font-black text-white">{value}</div>
                    <div className="mt-1 text-xs text-[#6F8C82]">{mid}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-2.5">
                {dealEvents.map(([title, status, text], index) => (
                  <div key={title} className="flow-dot flex gap-3 rounded-xl border border-[rgba(126,242,196,0.07)] bg-[#111C19] px-4 py-3">
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
                Следующий шаг: сверить лабораторию, закрыть ЭПД/ЭДО-пакет и выпустить безопасную часть денег через банковый контур.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="result" className="relative z-10 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-mint">что получает участник</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Первый продукт — не демо. Карта потерь одной сделки.</h2>
            <p className="text-lg leading-relaxed text-[#8BA89E]">Человек оставляет заявку не ради презентации. Он получает прикладной разбор: где риск, какие деньги затронуты, какой документ нужен и кто должен действовать.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {deliverables.map(([title, text]) => (
              <div key={title} className="premium-card rounded-2xl p-6 transition hover:-translate-y-1">
                <h3 className="mb-3 text-lg font-black text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-[#8BA89E]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="money" className="lux-line relative z-10 py-24 grid-bg">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-[rgba(245,180,30,0.24)] bg-[rgba(245,180,30,0.06)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F5B41E]">финансовая логика</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Где на одной сделке теряются деньги.</h2>
            <p className="text-lg leading-relaxed text-[#8BA89E]">Модельная сделка из канонического контура: 240 т по 16 140 ₽/т. Платформа не обещает магию. Она показывает риск, удержание, основание и следующий проверяемый шаг.</p>
          </div>
          <div className="premium-panel rounded-3xl p-6">
            <div className="space-y-3">
              {moneyRows.map(([label, mid, value]) => (
                <div key={label} className="grid gap-3 rounded-2xl border border-[rgba(126,242,196,0.08)] bg-[#111C19] p-4 md:grid-cols-[1fr_0.8fr_0.8fr]">
                  <div className="font-semibold text-white">{label}</div>
                  <div className="text-sm text-[#8BA89E]">{mid}</div>
                  <div className="font-mono text-lg font-black text-mint md:text-right">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-[rgba(255,139,144,0.18)] bg-[rgba(255,139,144,0.055)] p-4 text-sm leading-relaxed text-[#F3B2B5]">
              Финальный выпуск денег нельзя привязывать к звонку или обещанию. Нужны событие сделки, документный пакет, лаборатория, банковое подтверждение и воспроизводимый след.
            </div>
          </div>
        </div>
      </section>

      <section id="trust" className="relative z-10 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 max-w-4xl">
            <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-mint">Сбер · AI · Минсельхоз</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Доверительный слой должен быть виден, но без ложных обещаний.</h2>
            <p className="text-lg leading-relaxed text-[#8BA89E]">Лендинг делает упор на продукты Сбера и ИИ, но честно отделяет предынтеграционный сценарий от боевого подключения. Минсельхоз используется как подтверждение актуальности и пилотной целесообразности, а не как фальшивое “одобрено”.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {trust.map(([title, text]) => (
              <div key={title} className="premium-card rounded-2xl p-6 transition hover:-translate-y-1">
                <div className="mb-4 inline-flex rounded-full border border-[rgba(126,242,196,0.12)] bg-[rgba(126,242,196,0.04)] px-3 py-1 text-xs font-black uppercase tracking-wide text-mint">{title}</div>
                <p className="text-sm leading-relaxed text-[#8BA89E]">{text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-3xl border border-[rgba(245,180,30,0.18)] bg-[rgba(245,180,30,0.06)] p-6 text-sm leading-relaxed text-[#D7C895]">
            Юридическая граница: live-интеграции со Сбером, СберКорус, ФГИС, ЭДО, ГИС ЭПД, КЭП/МЧД и банковым контуром требуют договора, доступа, настройки и проверки на реальной цепочке.
          </div>
        </div>
      </section>

      <section id="pilot" className="lux-line relative z-10 py-24 grid-bg">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-[rgba(245,180,30,0.24)] bg-[rgba(245,180,30,0.06)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F5B41E]">controlled pilot</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Нам не нужна массовая регистрация. Нужна одна рабочая цепочка.</h2>
            <p className="text-lg leading-relaxed text-[#8BA89E]">Пилот проверяет не интерфейс ради интерфейса, а способность довести сделку от цены до денег без потери фактов.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-7">
            {pilotChain.map((item, index) => (
              <div key={item} className="premium-card rounded-2xl p-5">
                <div className="mb-4 font-mono text-xs text-[#4A6B5E]">{String(index + 1).padStart(2, '0')}</div>
                <div className="text-sm font-black text-white">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="sample" className="relative z-10 py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-mint">пример результата</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Так выглядит карта потерь сделки.</h2>
            <p className="text-lg leading-relaxed text-[#8BA89E]">До заявки человек должен понимать, что он получит: не “созвон”, а структуру рисков и следующий шаг.</p>
            <a href="#contact" className="lux-button mt-8 inline-flex rounded-xl bg-brand px-7 py-4 font-semibold text-white hover:bg-brand-hover">Получить такую карту</a>
          </div>
          <div className="premium-panel rounded-3xl p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[rgba(126,242,196,0.08)] pb-5">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#4A6B5E]">карта потерь</div>
                <div className="mt-2 text-xl font-black text-white">DL-9102 · 3 873 600 ₽</div>
              </div>
              <span className="rounded-full bg-[rgba(126,242,196,0.08)] px-3 py-1 text-xs font-semibold text-mint">черновик разбора</span>
            </div>
            <div className="space-y-3">
              {sampleRisks.map(([risk, problem, action]) => (
                <div key={risk} className="rounded-2xl border border-[rgba(126,242,196,0.08)] bg-[#111C19] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-white">{risk}</div>
                    <div className="text-xs font-semibold text-[#F5B41E]">{problem}</div>
                  </div>
                  <div className="mt-2 text-sm text-[#8BA89E]">Что делать: {action}.</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="lux-line relative z-10 overflow-hidden py-24 grid-bg">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            <span className="text-xs font-semibold uppercase tracking-wide text-mint">следующий шаг</span>
          </div>
          <h2 className="mb-6 text-4xl font-black tracking-tight md:text-6xl">Получите карту потерь по вашей сделке.</h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[#8BA89E]">Опишите одну реальную или типовую сделку: культура, объём, маршрут, приёмка, документы, оплата или спор. Ответим с фокусом на деньги, факты, Сбер-контур, AI-риски и пилот.</p>
          <PilotLeadForm />
        </div>
      </section>

      <footer className="relative z-10 border-t border-[rgba(126,242,196,0.08)] py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <div className="font-bold text-white">Прозрачная <span className="text-mint">Цена</span></div>
              <div className="mt-1 text-sm text-[#4A6B5E]">контур исполнения внебиржевой зерновой сделки</div>
            </div>
          </div>
          <div className="max-w-xl text-xs leading-relaxed text-[#4A6B5E] md:text-right">Предпилотная версия. Сайт не является публичной офертой, банковской гарантией, официальным заявлением Сбера или Минсельхоза, либо подтверждением завершённых боевых интеграций.</div>
        </div>
      </footer>
    </main>
  );
}
