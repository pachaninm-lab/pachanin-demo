const roles = [
  ['КФХ / продавец', 'Вы отгрузили зерно. Потом начались недовес, влажность, удержание и задержка оплаты. Нужно видеть, кто и на каком основании держит деньги.'],
  ['Покупатель зерна', 'Вы купили партию. До оплаты нужно понять: что реально приехало, какие документы закрыты и где риск по качеству или весу.'],
  ['Элеватор', 'Вы принимаете зерно. Если вес, лаборатория и документы живут отдельно, спор прилетает к вам.'],
  ['Логистика', 'Рейс нельзя терять между звонками, накладными, погрузкой, приёмкой и ожиданием документов.'],
  ['Банк / финансирование', 'Платёж должен опираться на событие сделки: подтверждение, риск, удержание, основание для выпуска.'],
  ['Инвестор / регион', 'Видно не обещание маркетплейса, а инфраструктурный слой исполнения: деньги, документы, риски и спорность.'],
];

export default function RoleEntry() {
  return (
    <section id="roles" className="relative z-10 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 max-w-3xl">
          <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-mint">кто вы в сделке</div>
          <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Каждый участник теряет в своём месте.</h2>
          <p className="text-lg leading-relaxed text-[#8BA89E]">Лендинг сразу показывает ценность для роли, а не заставляет разбираться в абстрактной платформе.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map(([title, text]) => (
            <a href="#contact" key={title} className="premium-card group rounded-2xl p-6 transition hover:-translate-y-1">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-black text-white">{title}</h3>
                <span className="rounded-full border border-[rgba(126,242,196,0.12)] px-3 py-1 text-xs text-mint transition group-hover:border-[rgba(126,242,196,0.35)]">разобрать</span>
              </div>
              <p className="text-sm leading-relaxed text-[#8BA89E]">{text}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
