const steps = [
  {
    num: '01',
    title: 'Допуск и верификация',
    desc: 'Покупатель и продавец проходят KYB-проверку. ИНН, ОГРН, санкции, бенефициары — платформа допускает только верифицированных участников.',
    badge: 'Комплаенс',
  },
  {
    num: '02',
    title: 'RFQ и офер',
    desc: 'Покупатель формирует запрос на покупку с параметрами: культура, регион, объём, базис. Продавец видит запрос и выставляет предложение с ценой.',
    badge: 'Маркетплейс',
  },
  {
    num: '03',
    title: 'Договор и резерв средств',
    desc: 'При подтверждении сделки банковский модуль резервирует деньги покупателя. Сделка получает статус MONEY_RESERVED — продавец видит гарантию оплаты.',
    badge: 'Банк',
  },
  {
    num: '04',
    title: 'Логистика и GPS',
    desc: 'Формируется ЭТрН, назначается перевозчик, водитель принимает рейс в мобильном PWA. Трек в реальном времени виден всем участникам.',
    badge: 'Логистика',
  },
  {
    num: '05',
    title: 'Весовая и лаборатория',
    desc: 'На элеваторе проводится взвешивание с QR-верификацией. Лаборатория фиксирует качество по ГОСТ. Отклонения → автоматический перерасчёт цены.',
    badge: 'Элеватор · Лаб',
  },
  {
    num: '06',
    title: 'Документы и ФГИС',
    desc: 'СДИЗ, ТН, акт приёмки формируются в EDO и передаются в ФГИС. Цепочка доказательств полностью сохранена.',
    badge: 'Документы',
  },
  {
    num: '07',
    title: 'Расчёт и закрытие',
    desc: 'Банк высвобождает средства продавцу. Сделка переходит в статус CLOSED с полным пакетом документов и финансовой историей.',
    badge: 'Финал',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] mb-6">
            <span className="text-xs font-medium text-mint uppercase tracking-wide">Процесс</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight">
            Как проходит сделка<br />
            <span className="gradient-text">от запроса до расчёта</span>
          </h2>
          <p className="text-[#8BA89E] max-w-xl mx-auto text-base md:text-lg">
            7 этапов — каждый автоматизирован, документирован и подтверждён цифровой подписью.
          </p>
        </div>

        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] md:left-1/2 md:-translate-x-px top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-[rgba(126,242,196,0.2)] to-transparent hidden md:block" />

          <div className="space-y-6">
            {steps.map((step, i) => (
              <div
                key={step.num}
                className={`relative flex gap-6 md:gap-0 ${
                  i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                } items-center`}
              >
                {/* Content */}
                <div className={`flex-1 ${i % 2 === 0 ? 'md:pr-12 md:text-right' : 'md:pl-12'}`}>
                  <div
                    className={`card-glass rounded-2xl p-5 transition-all duration-300 hover:border-[rgba(126,242,196,0.25)] inline-block w-full md:max-w-sm ${
                      i % 2 === 0 ? 'md:ml-auto' : ''
                    }`}
                  >
                    <div className={`flex items-center gap-2 mb-2 ${i % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                      <span className="font-mono text-xs text-[#4A6B5E]">{step.num}</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[rgba(126,242,196,0.08)] text-mint border border-[rgba(126,242,196,0.15)]">
                        {step.badge}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-[#EAF1EE] mb-1.5">{step.title}</h3>
                    <p className="text-xs text-[#8BA89E] leading-relaxed">{step.desc}</p>
                  </div>
                </div>

                {/* Center dot */}
                <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 z-10 w-8 h-8 rounded-full bg-brand border-2 border-[#0B1513] items-center justify-center">
                  <span className="text-[10px] font-bold text-white">{i + 1}</span>
                </div>

                {/* Empty side */}
                <div className="hidden md:block flex-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
