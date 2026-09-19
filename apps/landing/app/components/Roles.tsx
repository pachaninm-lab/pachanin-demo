const roles = [
  {
    icon: '🏢',
    title: 'Агрохолдинги и трейдеры',
    desc: 'Закрывайте сделки в одном контуре. Банкабельные документы, прозрачная цена, защищённые расчёты.',
    cta: 'Кабинет покупателя',
  },
  {
    icon: '🌾',
    title: 'Фермеры и КФХ',
    desc: 'Выходите на покупателей без посредников. Зафиксированная цена, гарантированный резерв средств.',
    cta: 'Кабинет продавца',
  },
  {
    icon: '🚚',
    title: 'Логистические компании',
    desc: 'Получайте рейсы, подписывайте ЭТрН, отправляйте трек прямо с телефона. Всё в одном PWA.',
    cta: 'Модуль логистики',
  },
  {
    icon: '🏗️',
    title: 'Элеваторы и зернохранилища',
    desc: 'QR-верификация при приёмке, привязка к СДИЗ, автоматическая передача данных в платформу.',
    cta: 'Модуль элеватора',
  },
  {
    icon: '🏦',
    title: 'Банки и финансовые институты',
    desc: 'Подключитесь к готовому контуру: сделки, резервы, удержания и выплаты синхронизированы с исполнением.',
    cta: 'Банковский модуль',
  },
  {
    icon: '⚙️',
    title: 'Операторы платформы',
    desc: 'Control Tower с полной видимостью: деньги под риском, SLA, блокировки, очередь эскалаций.',
    cta: 'Control Tower',
  },
];

export default function Roles() {
  return (
    <section id="roles" className="py-24 relative">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(10,122,95,0.08) 0%, transparent 70%)',
        }}
      />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] mb-6">
            <span className="text-xs font-medium text-mint uppercase tracking-wide">Участники</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight">
            Кабинет для каждого<br />
            <span className="gradient-text">участника цепочки</span>
          </h2>
          <p className="text-[#8BA89E] max-w-xl mx-auto text-base md:text-lg">
            Каждая роль видит только своё — но данные у всех общие и синхронные.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((r) => (
            <div
              key={r.title}
              className="card-glass rounded-2xl p-6 transition-all duration-300 group hover:translate-y-[-2px] flex flex-col"
            >
              <div className="text-3xl mb-4">{r.icon}</div>
              <h3 className="text-base font-bold text-[#EAF1EE] mb-2">{r.title}</h3>
              <p className="text-sm text-[#8BA89E] leading-relaxed flex-1 mb-4">{r.desc}</p>
              <div className="text-xs font-medium text-mint flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                {r.cta}
                <span>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
