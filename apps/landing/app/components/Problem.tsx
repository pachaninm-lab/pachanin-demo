const pains = [
  {
    icon: '💬',
    title: 'Сделки уходят в мессенджеры',
    desc: 'После первого контакта покупатель и продавец переходят в WhatsApp. Платформа теряет контроль над ценой, условиями и документами.',
  },
  {
    icon: '🏦',
    title: 'Деньги живут отдельно от сделки',
    desc: 'Предоплата, резерв, удержание и выплата не связаны с фактическим исполнением. Банк не видит контекст — нет основания для финансирования.',
  },
  {
    icon: '📄',
    title: 'Документы теряются',
    desc: 'ТН, СДИЗ, ЭТрН, акт приёмки — каждый в своём канале. Нет единой цепочки доказательств для споров и аудита.',
  },
  {
    icon: '⚖️',
    title: 'Споры без доказательной базы',
    desc: 'При расхождении в весе или качестве нет объективных данных. Стороны теряют время и деньги без чёткого арбитражного механизма.',
  },
];

export default function Problem() {
  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(255,139,144,0.25)] bg-[rgba(255,139,144,0.05)] mb-6">
            <span className="text-xs font-medium text-[#FF8B90] uppercase tracking-wide">Проблема</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight">
            Почему зерновые сделки<br />
            <span className="gradient-text">теряются между системами</span>
          </h2>
          <p className="text-[#8BA89E] max-w-xl mx-auto text-base md:text-lg">
            Типичная сделка проходит через десятки точек — и в каждой из них что-то может пойти не так.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {pains.map((p) => (
            <div
              key={p.title}
              className="card-glass rounded-2xl p-6 transition-all duration-300 group"
            >
              <div className="text-3xl mb-4">{p.icon}</div>
              <h3 className="text-base font-bold text-[#EAF1EE] mb-2">{p.title}</h3>
              <p className="text-sm text-[#8BA89E] leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>

        {/* Solution bridge */}
        <div className="mt-12 text-center">
          <div
            className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.04)]"
          >
            <span className="text-mint text-xl">→</span>
            <p className="text-sm md:text-base text-[#EAF1EE]">
              <span className="font-bold text-mint">Прозрачная Цена</span> держит сделку в одном контуре — от допуска и цены до документов, денег и спора.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
