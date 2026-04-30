const features = [
  {
    icon: '🗼',
    title: 'Control Tower',
    desc: 'Операторский дашборд: KPI, деньги под риском, заблокированные интеграции, нарушения SLA и живая очередь сделок.',
    tag: 'Оператор',
  },
  {
    icon: '🤝',
    title: 'Сделки',
    desc: 'Полный жизненный цикл: DRAFT → ПРОВЕРКА → ДОГОВОР → РЕЗЕРВ → ЛОГИСТИКА → ВЕСОВАЯ → ЛАБОРАТОРИЯ → ПРИЁМКА → ДОКУМЕНТЫ → ЗАКРЫТО.',
    tag: 'Все участники',
  },
  {
    icon: '🛒',
    title: 'Кабинет покупателя',
    desc: 'Поиск лотов, создание RFQ, сравнение предложений, управление кредитным лимитом и резервами.',
    tag: 'Покупатель',
  },
  {
    icon: '🌾',
    title: 'Кабинет продавца',
    desc: 'Создание лотов, управление ценой и объёмом, выход на покупателей, репутационный профиль.',
    tag: 'Продавец',
  },
  {
    icon: '🏦',
    title: 'Банковский модуль',
    desc: 'Резервирование, удержание, высвобождение средств, смарт-контракт, ручная проверка и сверка — синхронно со сделкой.',
    tag: 'Банк',
  },
  {
    icon: '🛡️',
    title: 'Комплаенс',
    desc: 'KYB-проверка контрагентов: ИНН, ОГРН, директора, бенефициары, санкционные списки. Допуск только верифицированных участников.',
    tag: 'Безопасность',
  },
  {
    icon: '🚚',
    title: 'Логистика',
    desc: 'Планирование маршрутов, ЭТрН, GPS-трекинг транспорта, координация перевозчика в реальном времени.',
    tag: 'Логистика',
  },
  {
    icon: '🔬',
    title: 'Лаборатория',
    desc: 'Протоколы качества по ГОСТ, арбитражный анализ, расчёт ценовых корректировок при отклонениях.',
    tag: 'Качество',
  },
  {
    icon: '⚖️',
    title: 'Споры',
    desc: 'Комната доказательств: таймлайн событий, чат сторон, движок решений. Итог в PDF с обоснованием.',
    tag: 'Арбитраж',
  },
  {
    icon: '🏗️',
    title: 'Элеватор',
    desc: 'Терминал весовщика: QR-верификация, приёмка, отклонения по качеству, привязка к СДИЗ.',
    tag: 'Элеватор',
  },
  {
    icon: '📱',
    title: 'Поле (PWA)',
    desc: 'Мобильный кабинет водителя с офлайн-очередью, геолокацией, подписью документов и отчётами об инцидентах.',
    tag: 'Водитель',
  },
  {
    icon: '📊',
    title: 'Инвесторский дашборд',
    desc: 'Сводка для руководства и инвесторов: юнит-экономика, региональная аналитика, банкабельное досье.',
    tag: 'Инвестор',
  },
];

export default function Features() {
  return (
    <section id="features" className="py-24 relative grid-bg">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 100%, rgba(10,122,95,0.12) 0%, transparent 70%)',
        }}
      />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] mb-6">
            <span className="text-xs font-medium text-mint uppercase tracking-wide">Платформа</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight">
            12 модулей — один контур
          </h2>
          <p className="text-[#8BA89E] max-w-xl mx-auto text-base md:text-lg">
            Каждый участник работает в своём кабинете, все данные синхронны — ничего не теряется и не дублируется.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="card-glass rounded-2xl p-5 transition-all duration-300 group hover:translate-y-[-2px]"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-bold text-[#EAF1EE]">{f.title}</h3>
                <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(126,242,196,0.08)] text-[#7EF2C4] border border-[rgba(126,242,196,0.15)]">
                  {f.tag}
                </span>
              </div>
              <p className="text-xs text-[#8BA89E] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
