const lossPoints = [
  {
    title: 'Цена согласована, но условия расползлись',
    text: 'Базис, допуски, сроки, удержания и порядок расчёта часто остаются в переписке. В споре каждая сторона вспоминает свою версию.',
  },
  {
    title: 'Рейс живёт отдельно от сделки',
    text: 'Машина, водитель, маршрут, весовая и элеватор появляются уже после договорённости. Ошибка на маршруте сразу превращается в деньги под риском.',
  },
  {
    title: 'Качество и вес фиксируются поздно',
    text: 'Влага, сорность, натура, протеин, недовес и пересортица становятся предметом торга после факта, когда позиция сторон уже конфликтная.',
  },
  {
    title: 'Документы не собираются в доказательство',
    text: 'СДИЗ, ЭДО, ЭТрН, акты, лаборатория, фото и переписка находятся в разных местах. Для банка, юриста и руководителя нет единой картины.',
  },
];

const contour = [
  'допуск сторон',
  'паспорт партии',
  'условия сделки',
  'логистика',
  'приёмка',
  'документы',
  'расчёт',
  'спор и доказательства',
];

const capabilities = [
  {
    title: 'Единая версия сделки',
    text: 'Цена, объём, качество, базис, сроки, допуски и ответственные фиксируются как управляемый объект, а не как набор сообщений.',
  },
  {
    title: 'Контроль исполнения',
    text: 'Каждый этап имеет статус, владельца, срок, следующий шаг и причину блокировки. Видно, где сделка реально остановилась.',
  },
  {
    title: 'Деньги привязаны к факту',
    text: 'Логика резерва, удержаний, частичного выпуска и финального расчёта проектируется вокруг подтверждённого исполнения, а не доверия на словах.',
  },
  {
    title: 'Доказательная база с первого дня',
    text: 'Вес, качество, документы, события, комментарии и решения собираются в цепочку, которую можно показать банку, юристу, руководителю или арбитру.',
  },
  {
    title: 'Антиобходной контур',
    text: 'Смысл платформы — удержать ценность внутри сделки: контроль денег, документов, споров и истории исполнения должен быть выгоднее ухода в чат.',
  },
  {
    title: 'Предынтеграционный слой',
    text: 'ФГИС «Зерно», СДИЗ, ЭДО, ЭТрН, банк и 1С рассматриваются как точки подключения. Боевые интеграции требуют договоров, доступов и проверки.',
  },
];

const steps = [
  ['01', 'Цена и допуск', 'Стороны, партия, базис, требования к качеству и ограничения фиксируются до сделки.'],
  ['02', 'Сделка', 'Условия переводятся в единый контур: кто, что, сколько, когда, на каких документах и с каким порядком расчёта.'],
  ['03', 'Логистика', 'Рейс связывается со сделкой: перевозчик, водитель, маршрут, точки контроля, документы и риск отклонений.'],
  ['04', 'Приёмка', 'Весовая, элеватор, лаборатория и качество становятся частью сделки, а не отдельным спором после факта.'],
  ['05', 'Документы', 'СДИЗ, ЭДО, транспортные документы, акты и подтверждения собираются в единый пакет.'],
  ['06', 'Деньги', 'Резерв, удержание, частичный выпуск и финальный расчёт завязаны на подтверждённые события сделки.'],
  ['07', 'Спор', 'При отклонении формируется не хаос переписки, а пакет фактов: что произошло, кто подтвердил, где возник риск.'],
];

const audiences = [
  {
    title: 'Продавцу',
    text: 'Понятно, за что удерживают деньги, какие отклонения признаны и когда будет расчёт.',
  },
  {
    title: 'Покупателю',
    text: 'Видно, что реально приехало, какие документы закрыты и где риск качества, веса или срока.',
  },
  {
    title: 'Логистике',
    text: 'Рейс не висит отдельно: он связан со сделкой, точками контроля и документами.',
  },
  {
    title: 'Элеватору',
    text: 'Приёмка, вес и лаборатория становятся доказуемой частью исполнения, а не устным спором.',
  },
  {
    title: 'Банку',
    text: 'Появляется контекст для контроля денег: событие, документ, риск, основание для выпуска или удержания.',
  },
  {
    title: 'Региону',
    text: 'Сделки становятся измеримыми по исполнению: где срывы, где документы, где деньги, где спорность.',
  },
];

const pilotChecks = [
  'проверка сквозного сценария сделки на реальных ролях',
  'сверка логики СДИЗ, ЭДО, ЭТрН и банковского контура',
  'проверка спорных сценариев: недовес, качество, задержка, удержание',
  'оценка операционной нагрузки: кто и какие данные вводит',
  'проверка мотивации сторон не уводить сделку в мессенджеры',
];

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-[#030D0A] text-[#EAF1EE]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(126,242,196,0.08)] bg-[rgba(3,13,10,0.88)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <a href="#top" className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-black text-mint">ПЦ</span>
            <span className="text-[15px] font-bold tracking-tight">Прозрачная <span className="text-mint">Цена</span></span>
          </a>
          <nav className="hidden items-center gap-7 md:flex">
            <a href="#problem" className="text-sm text-[#8BA89E] transition-colors hover:text-white">Проблема</a>
            <a href="#solution" className="text-sm text-[#8BA89E] transition-colors hover:text-white">Решение</a>
            <a href="#pilot" className="text-sm text-[#8BA89E] transition-colors hover:text-white">Пилот</a>
            <a href="#contact" className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover">Обсудить пилот</a>
          </nav>
          <a href="#contact" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white md:hidden">Пилот</a>
        </div>
      </header>

      <section id="top" className="relative min-h-screen overflow-hidden pt-28 grid-bg">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(10,122,95,0.24),transparent_70%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              <span className="text-xs font-medium uppercase tracking-wide text-mint">Предпилотный контур · controlled pilot</span>
            </div>
            <h1 className="mb-6 max-w-4xl text-5xl font-black leading-[1.04] tracking-tight md:text-7xl">
              Зерновая сделка —<br />
              <span className="gradient-text">от цены до денег</span><br />
              без разрыва контура
            </h1>
            <p className="mb-10 max-w-2xl text-lg leading-relaxed text-[#8BA89E] md:text-xl">
              «Прозрачная Цена» — цифровой контур исполнения внебиржевой зерновой сделки. Не доска объявлений и не CRM, а слой контроля: условия, логистика, приёмка, документы, деньги, спор и доказательства.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <a href="#contact" className="rounded-xl bg-brand px-8 py-4 text-center font-semibold text-white transition-all glow hover:scale-[1.02] hover:bg-brand-hover">Обсудить controlled pilot</a>
              <a href="#solution" className="rounded-xl border border-[rgba(126,242,196,0.2)] px-8 py-4 text-center font-medium text-[#EAF1EE] transition-all hover:border-[rgba(126,242,196,0.4)]">Посмотреть механику</a>
            </div>
          </div>

          <div className="card-glass rounded-3xl p-5 glow">
            <div className="rounded-2xl bg-[#0B1513] p-5">
              <div className="mb-5 flex items-center justify-between border-b border-[rgba(126,242,196,0.08)] pb-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-[#4A6B5E]">Объект контроля</div>
                  <div className="mt-1 text-lg font-bold text-white">Исполнение сделки</div>
                </div>
                <span className="rounded-full border border-[rgba(126,242,196,0.16)] bg-[rgba(126,242,196,0.06)] px-3 py-1 text-xs font-medium text-mint">не marketplace</span>
              </div>
              <div className="space-y-3">
                {contour.map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-xl border border-[rgba(126,242,196,0.07)] bg-[#111C19] px-4 py-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(126,242,196,0.08)] font-mono text-xs text-mint">{index + 1}</span>
                    <span className="text-sm text-[#C9D8D2]">{item}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-[rgba(245,180,30,0.18)] bg-[rgba(245,180,30,0.06)] p-4 text-sm leading-relaxed text-[#D7C895]">
                Зрелость формулируется честно: сильная предпилотная сборка. Боевые подключения, банк и интеграции подтверждаются отдельно в управляемом пилоте.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[rgba(126,242,196,0.08)] py-10">
        <div className="mx-auto grid max-w-7xl gap-3 px-6 md:grid-cols-4">
          {['Не витрина лотов', 'Не чат вместо сделки', 'Не обещание без фактов', 'Не production без пилота'].map((item) => (
            <div key={item} className="rounded-2xl border border-[rgba(126,242,196,0.08)] bg-[rgba(126,242,196,0.03)] p-4 text-center text-sm font-semibold text-[#C9D8D2]">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section id="problem" className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-[rgba(255,139,144,0.24)] bg-[rgba(255,139,144,0.05)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#FF8B90]">Где теряются деньги</div>
            <h2 className="mb-4 text-3xl font-black tracking-tight md:text-5xl">В АПК зарабатывают на цене, а теряют на исполнении</h2>
            <p className="text-lg leading-relaxed text-[#8BA89E]">Проблема начинается после рукопожатия: машина ещё не назначена, качество не подтверждено, документы не собраны, деньги не привязаны к факту, а спор уже заложен в сделку.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {lossPoints.map((point) => (
              <div key={point.title} className="card-glass rounded-2xl p-6">
                <h3 className="mb-2 text-base font-bold text-white">{point.title}</h3>
                <p className="text-sm leading-relaxed text-[#8BA89E]">{point.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="solution" className="relative py-24 grid-bg">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_50%,rgba(10,122,95,0.12),transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mb-14 text-center">
            <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-mint">Что делает контур</div>
            <h2 className="mb-4 text-3xl font-black tracking-tight md:text-5xl">Собирает сделку в проверяемую цепочку</h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-[#8BA89E]">Система должна отвечать на три вопроса: где деньги, что подтверждено, кто сейчас блокирует исполнение.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((item) => (
              <div key={item.title} className="card-glass rounded-2xl p-6 transition-all hover:translate-y-[-2px]">
                <h3 className="mb-2 text-base font-bold text-white">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[#8BA89E]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 text-center">
            <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-mint">Механика сделки</div>
            <h2 className="mb-4 text-3xl font-black tracking-tight md:text-5xl">От цены до расчёта — 7 контрольных точек</h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-[#8BA89E]">Это не обещание автоматизировать всё сразу. Это карта controlled pilot: что проверяется, где нужны данные, где возникает риск.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-7">
            {steps.map(([num, title, text]) => (
              <div key={num} className="card-glass rounded-2xl p-5">
                <div className="mb-4 font-mono text-xs text-[#4A6B5E]">{num}</div>
                <h3 className="mb-2 text-sm font-bold text-white">{title}</h3>
                <p className="text-xs leading-relaxed text-[#8BA89E]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-24 grid-bg">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 text-center">
            <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-mint">Кому выгодно</div>
            <h2 className="mb-4 text-3xl font-black tracking-tight md:text-5xl">Один контур — разные выгоды</h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-[#8BA89E]">Ценность не в красивом интерфейсе, а в снижении спорности, ручного труда и неопределённости по деньгам.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {audiences.map((item) => (
              <div key={item.title} className="card-glass rounded-2xl p-6">
                <h3 className="mb-2 text-base font-bold text-white">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[#8BA89E]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pilot" className="relative py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-[rgba(245,180,30,0.24)] bg-[rgba(245,180,30,0.06)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#F5B41E]">Controlled pilot</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Сейчас нужен не громкий запуск, а проверка сделки вживую</h2>
            <p className="text-lg leading-relaxed text-[#8BA89E]">Правильная цель пилота — доказать, что контур снижает спорность, удерживает сделку внутри системы и даёт банку/руководителю понятную картину исполнения.</p>
          </div>
          <div className="card-glass rounded-3xl p-6">
            <h3 className="mb-5 text-lg font-bold text-white">Что проверяется в пилоте</h3>
            <div className="space-y-3">
              {pilotChecks.map((item, index) => (
                <div key={item} className="flex gap-3 rounded-xl border border-[rgba(126,242,196,0.07)] bg-[#111C19] p-4">
                  <span className="font-mono text-xs text-mint">{index + 1}</span>
                  <span className="text-sm leading-relaxed text-[#C9D8D2]">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-[rgba(245,180,30,0.18)] bg-[rgba(245,180,30,0.06)] p-4 text-sm leading-relaxed text-[#D7C895]">
              ФГИС «Зерно», СДИЗ, ЭДО, ЭТрН, банковские операции и 1С не заявляются как закрытые боевые интеграции без отдельного подтверждения.
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="relative overflow-hidden py-24 grid-bg">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_50%,rgba(10,122,95,0.20),transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            <span className="text-xs font-medium uppercase tracking-wide text-mint">Следующий шаг</span>
          </div>
          <h2 className="mb-6 text-4xl font-black tracking-tight md:text-6xl">Собрать пилот вокруг реальной сделки</h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[#8BA89E]">Нужны не абстрактные пользователи, а конкретная цепочка: продавец, покупатель, логистика, точка приёмки, документы и сценарий расчёта. После этого контур можно проверять предметно.</p>
          <div className="card-glass mx-auto max-w-2xl rounded-3xl p-6 text-left glow">
            <div className="mb-5 text-sm font-semibold uppercase tracking-wide text-[#4A6B5E]">Минимальный пакет для старта пилота</div>
            <div className="grid gap-3 md:grid-cols-2">
              {['тип культуры и объём', 'регион и маршрут', 'стороны сделки', 'точка приёмки', 'документы в цепочке', 'логика оплаты'].map((item) => (
                <div key={item} className="rounded-xl border border-[rgba(126,242,196,0.08)] bg-[#111C19] px-4 py-3 text-sm text-[#C9D8D2]">{item}</div>
              ))}
            </div>
            <div className="mt-6 rounded-xl bg-brand px-5 py-4 text-center font-semibold text-white">Канал заявок подключается отдельно: почта, CRM или форма Vercel</div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[rgba(126,242,196,0.08)] py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-bold text-white">Прозрачная <span className="text-mint">Цена</span></div>
            <div className="mt-1 text-sm text-[#4A6B5E]">Цифровой контур исполнения внебиржевой зерновой сделки</div>
          </div>
          <div className="max-w-xl text-xs leading-relaxed text-[#4A6B5E] md:text-right">
            Предпилотная версия. Материалы сайта не являются публичной офертой, банковской гарантией или подтверждением завершённых боевых интеграций.
          </div>
        </div>
      </footer>
    </main>
  );
}
