const dealPath = [
  'цена',
  'допуск',
  'рейс',
  'вес',
  'качество',
  'документы',
  'деньги',
];

const pains = [
  {
    title: 'После цены начинается настоящая сделка',
    text: 'Покупатель и продавец договорились. Но дальше появляются машина, водитель, элеватор, лаборатория, СДИЗ, ЭДО, удержания и сроки оплаты. Именно там чаще всего и возникают потери.',
  },
  {
    title: 'Каждый держит свою версию',
    text: 'Условия в телефоне, документы в почте, фото у водителя, результаты качества у лаборатории, расчёт у бухгалтерии. Когда начинается спор, общей картины уже нет.',
  },
  {
    title: 'Деньги оторваны от факта исполнения',
    text: 'Оплата, резерв, удержание и финальный расчёт часто идут отдельно от того, что реально произошло с партией. Для банка и руководителя это слабое место.',
  },
];

const principles = [
  {
    title: 'Одна сделка. Один след.',
    text: 'Все важные события собираются вокруг сделки: кто подтвердил, когда подтвердил, какой документ появился и где возникло отклонение.',
  },
  {
    title: 'Не красивый кабинет, а контроль денег.',
    text: 'Главный вопрос не в том, как выглядит экран. Главный вопрос: можно ли понять, почему деньги надо выпустить, удержать или остановить.',
  },
  {
    title: 'Не заменяет рынок. Собирает исполнение.',
    text: 'Стороны могут договориться о цене где угодно. Ценность начинается там, где нужно довести сделку до приёмки, документов и расчёта.',
  },
  {
    title: 'Спор готовится до спора.',
    text: 'Если качество, вес, маршрут и документы фиксируются по ходу сделки, конфликт не превращается в переписку без конца.',
  },
];

const stages = [
  ['01', 'Условия', 'Цена, объём, базис, качество, допуски, сроки, порядок расчёта.'],
  ['02', 'Партия', 'Паспорт партии, происхождение, документы, ограничения, готовность к отгрузке.'],
  ['03', 'Рейс', 'Перевозчик, водитель, маршрут, точки контроля, транспортные документы.'],
  ['04', 'Приёмка', 'Вес, лаборатория, расхождения, комментарии сторон, основания для удержаний.'],
  ['05', 'Документы', 'СДИЗ, ЭДО, ЭТрН, акты, подтверждения и история изменений.'],
  ['06', 'Расчёт', 'Резерв, удержание, частичный выпуск, финальная оплата, причина задержки.'],
  ['07', 'Спор', 'Пакет фактов: события, документы, ответственные, сроки и предмет разногласия.'],
];

const whoNeedsIt = [
  ['Продавцу', 'понять, когда деньги будут выпущены и что именно стало основанием для удержания.'],
  ['Покупателю', 'видеть не только цену, но и фактическое исполнение: качество, вес, документы, риски.'],
  ['Логистике', 'не терять рейс между звонками, накладными, точками погрузки и приёмки.'],
  ['Элеватору', 'фиксировать приёмку так, чтобы данные потом не спорили с документами.'],
  ['Банку', 'получить контекст сделки: не просто платёж, а основание для резерва, удержания или выпуска.'],
  ['Региону', 'видеть, где сделки тормозят: документы, логистика, качество, расчёты или спорность.'],
];

const pilot = [
  'одна реальная цепочка: продавец, покупатель, перевозчик, точка приёмки, документы, расчёт',
  'понятный сценарий: от согласования цены до закрытия денег',
  'отдельные спорные случаи: недовес, качество, задержка, неполный пакет документов',
  'проверка ручного труда: кто вводит данные, где ошибается, что можно автоматизировать позже',
  'честная сверка интеграций: что уже можно показать, а что требует договоров и доступа',
];

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-[#030D0A] text-[#EAF1EE]">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[rgba(126,242,196,0.08)] bg-[rgba(3,13,10,0.88)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <a href="#top" className="flex items-center gap-3" aria-label="Прозрачная Цена">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-[12px] font-black text-mint">ПЦ</span>
            <span className="text-[15px] font-bold tracking-tight">Прозрачная <span className="text-mint">Цена</span></span>
          </a>
          <nav className="hidden items-center gap-7 md:flex">
            <a href="#why" className="text-sm text-[#8BA89E] transition-colors hover:text-white">Где потери</a>
            <a href="#contour" className="text-sm text-[#8BA89E] transition-colors hover:text-white">Контур</a>
            <a href="#pilot" className="text-sm text-[#8BA89E] transition-colors hover:text-white">Пилот</a>
            <a href="#contact" className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover">Обсудить сделку</a>
          </nav>
          <a href="#contact" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white md:hidden">Пилот</a>
        </div>
      </header>

      <section id="top" className="relative min-h-screen pt-28 grid-bg">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_0%,rgba(10,122,95,0.22),transparent_72%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 pb-24 pt-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" />
              <span className="text-xs font-medium uppercase tracking-wide text-mint">для controlled pilot в зерновой сделке</span>
            </div>
            <h1 className="mb-6 max-w-4xl text-5xl font-black leading-[1.02] tracking-tight md:text-7xl">
              Цена договорена.<br />
              <span className="gradient-text">Деньги ещё не заработаны.</span>
            </h1>
            <p className="mb-8 max-w-2xl text-lg leading-relaxed text-[#A7BBB4] md:text-xl">
              В зерне прибыль часто теряется не на торге, а после него: на рейсе, весе, качестве, документах, удержаниях и споре. «Прозрачная Цена» собирает эти точки в один проверяемый контур сделки.
            </p>
            <p className="mb-10 max-w-2xl text-sm leading-relaxed text-[#6F8C82]">
              Это не биржа, не доска объявлений и не обещание «всё автоматизировать». Это предпилотный слой контроля исполнения: от условий сделки до денег и доказательств.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <a href="#contact" className="rounded-xl bg-brand px-8 py-4 text-center font-semibold text-white transition-all glow hover:scale-[1.02] hover:bg-brand-hover">Разобрать пилотную сделку</a>
              <a href="#contour" className="rounded-xl border border-[rgba(126,242,196,0.2)] px-8 py-4 text-center font-medium text-[#EAF1EE] transition-all hover:border-[rgba(126,242,196,0.4)]">Как устроен контур</a>
            </div>
          </div>

          <div className="card-glass rounded-[28px] p-5 glow">
            <div className="rounded-[22px] bg-[#0B1513] p-5">
              <div className="mb-5 flex items-start justify-between gap-4 border-b border-[rgba(126,242,196,0.08)] pb-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-[#4A6B5E]">карта сделки</div>
                  <div className="mt-2 max-w-sm text-xl font-bold leading-snug text-white">Что должно быть видно до того, как деньги ушли</div>
                </div>
                <span className="rounded-full border border-[rgba(245,180,30,0.2)] bg-[rgba(245,180,30,0.06)] px-3 py-1 text-xs font-medium text-[#F5B41E]">предпилот</span>
              </div>
              <div className="space-y-2.5">
                {dealPath.map((item, index) => (
                  <div key={item} className="group flex items-center gap-3 rounded-xl border border-[rgba(126,242,196,0.07)] bg-[#111C19] px-4 py-3 transition-all hover:border-[rgba(126,242,196,0.22)]">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[rgba(126,242,196,0.08)] font-mono text-xs text-mint">{index + 1}</span>
                    <span className="text-sm text-[#C9D8D2]">{item}</span>
                    <span className="ml-auto h-px w-8 bg-[rgba(126,242,196,0.16)]" />
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-xl border border-[rgba(126,242,196,0.12)] bg-[rgba(126,242,196,0.045)] p-4 text-sm leading-relaxed text-[#A7BBB4]">
                Хорошая сделка должна отвечать без звонков: что подтверждено, где риск, кто держит следующий шаг и почему деньги нельзя выпускать вслепую.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[rgba(126,242,196,0.08)] py-9">
        <div className="mx-auto grid max-w-7xl gap-3 px-6 md:grid-cols-4">
          {['Без фейковых KPI', 'Без «production-ready»', 'Без обещаний интеграций', 'Без пересечения с платформой'].map((item) => (
            <div key={item} className="rounded-2xl border border-[rgba(126,242,196,0.08)] bg-[rgba(126,242,196,0.025)] p-4 text-center text-sm font-semibold text-[#C9D8D2]">
              {item}
            </div>
          ))}
        </div>
      </section>

      <section id="why" className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-[rgba(255,139,144,0.24)] bg-[rgba(255,139,144,0.05)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#FF8B90]">почему это больно</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">На бумаге сделка закрыта. В жизни она только началась.</h2>
            <p className="text-lg leading-relaxed text-[#8BA89E]">Рынок привык решать всё в телефоне. Это быстро, пока нет спора. Но когда партия не совпала по весу, качество упало, водитель опоздал или пакет документов неполный, переписка перестаёт быть управлением.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {pains.map((point) => (
              <div key={point.title} className="card-glass rounded-2xl p-6">
                <h3 className="mb-3 text-lg font-bold leading-snug text-white">{point.title}</h3>
                <p className="text-sm leading-relaxed text-[#8BA89E]">{point.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="contour" className="relative py-24 grid-bg">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_50%,rgba(10,122,95,0.12),transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mb-14 max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-mint">что меняется</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Сделка становится не разговором, а цепочкой фактов.</h2>
            <p className="text-lg leading-relaxed text-[#8BA89E]">Не нужно верить на слово. Нужно видеть, где партия, какие документы закрыты, что показала приёмка, почему возникло удержание и кто отвечает за следующий шаг.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {principles.map((item) => (
              <div key={item.title} className="card-glass rounded-2xl p-6 transition-all hover:translate-y-[-2px]">
                <h3 className="mb-3 text-base font-bold leading-snug text-white">{item.title}</h3>
                <p className="text-sm leading-relaxed text-[#8BA89E]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 text-center">
            <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-mint">маршрут сделки</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Семь мест, где сделку нельзя отпускать.</h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-[#8BA89E]">Их не надо украшать. Их надо зафиксировать, связать между собой и проверить на реальной цепочке.</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-7">
            {stages.map(([num, title, text]) => (
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
          <div className="mb-14 max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-mint">кому это нужно</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Каждый участник теряет в своём месте. Контур связывает эти места.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {whoNeedsIt.map(([role, text]) => (
              <div key={role} className="card-glass rounded-2xl p-6">
                <h3 className="mb-2 text-lg font-bold text-white">{role}</h3>
                <p className="text-sm leading-relaxed text-[#8BA89E]">Нужно {text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pilot" className="relative py-24">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-[rgba(245,180,30,0.24)] bg-[rgba(245,180,30,0.06)] px-3 py-1 text-xs font-medium uppercase tracking-wide text-[#F5B41E]">controlled pilot</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Сначала не масштаб. Сначала одна сделка, которую нельзя потерять.</h2>
            <p className="text-lg leading-relaxed text-[#8BA89E]">Пилот нужен не для красивой презентации. Он нужен, чтобы проверить слабые места: кто вводит данные, кто задерживает документы, где спорят о качестве, как деньги проходят через удержания и что должно видеть руководство.</p>
          </div>
          <div className="card-glass rounded-3xl p-6">
            <h3 className="mb-5 text-lg font-bold text-white">Что берём в пилот</h3>
            <div className="space-y-3">
              {pilot.map((item, index) => (
                <div key={item} className="flex gap-3 rounded-xl border border-[rgba(126,242,196,0.07)] bg-[#111C19] p-4">
                  <span className="font-mono text-xs text-mint">{index + 1}</span>
                  <span className="text-sm leading-relaxed text-[#C9D8D2]">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-[rgba(245,180,30,0.18)] bg-[rgba(245,180,30,0.06)] p-4 text-sm leading-relaxed text-[#D7C895]">
              Внешние подключения к ФГИС «Зерно», СДИЗ, ЭДО, ЭТрН, банку и 1С не заявляются как завершённые без отдельного доступа, договора и проверки на боевой цепочке.
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="relative overflow-hidden py-24 grid-bg">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_50%,rgba(10,122,95,0.20),transparent_70%)]" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            <span className="text-xs font-medium uppercase tracking-wide text-mint">следующий шаг</span>
          </div>
          <h2 className="mb-6 text-4xl font-black tracking-tight md:text-6xl">Покажите сделку, где сейчас есть риск.</h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[#8BA89E]">Маршрут, документы, оплата, спор по качеству, задержка на приёмке, удержание денег. На конкретной сделке сразу видно, нужен ли контур и где он даст пользу.</p>
          <div className="card-glass mx-auto max-w-2xl rounded-3xl p-6 text-left glow">
            <div className="mb-5 text-sm font-semibold uppercase tracking-wide text-[#4A6B5E]">Для предметного разговора достаточно</div>
            <div className="grid gap-3 md:grid-cols-2">
              {['культура и объём', 'регион и маршрут', 'стороны сделки', 'точка приёмки', 'пакет документов', 'логика оплаты'].map((item) => (
                <div key={item} className="rounded-xl border border-[rgba(126,242,196,0.08)] bg-[#111C19] px-4 py-3 text-sm text-[#C9D8D2]">{item}</div>
              ))}
            </div>
            <div className="mt-6 rounded-xl bg-brand px-5 py-4 text-center font-semibold text-white">Форма заявки подключается отдельно: почта, CRM или защищённый приём заявок</div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[rgba(126,242,196,0.08)] py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-bold text-white">Прозрачная <span className="text-mint">Цена</span></div>
            <div className="mt-1 text-sm text-[#4A6B5E]">контур исполнения внебиржевой зерновой сделки</div>
          </div>
          <div className="max-w-xl text-xs leading-relaxed text-[#4A6B5E] md:text-right">
            Предпилотная версия. Этот сайт не является публичной офертой, банковской гарантией или подтверждением завершённых боевых интеграций.
          </div>
        </div>
      </footer>
    </main>
  );
}
