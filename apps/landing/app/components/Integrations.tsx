const integrations = [
  { name: 'ФГИС Зерно', status: 'sandbox', desc: 'Реестр зерна, СДИЗ' },
  { name: 'Сбербанк', status: 'sandbox', desc: 'Резерв и расчёты' },
  { name: 'ЭДО (ЮЗДО)', status: 'sandbox', desc: 'Электронные документы' },
  { name: 'ЭТрН', status: 'sandbox', desc: 'Транспортная накладная' },
  { name: '152-ФЗ', status: 'live', desc: 'Защита данных' },
  { name: 'GPS-трекинг', status: 'live', desc: 'Геолокация транспорта' },
  { name: 'ОГРН / ФНС', status: 'live', desc: 'Проверка контрагентов' },
  { name: 'Санкционные списки', status: 'live', desc: 'KYB-комплаенс' },
];

const statusLabel: Record<string, { label: string; color: string }> = {
  live: { label: 'Работает', color: 'text-mint bg-[rgba(126,242,196,0.08)] border-[rgba(126,242,196,0.2)]' },
  sandbox: { label: 'Sandbox', color: 'text-[#F5B41E] bg-[rgba(245,180,30,0.08)] border-[rgba(245,180,30,0.2)]' },
};

export default function Integrations() {
  return (
    <section id="integrations" className="py-24 relative grid-bg">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(10,122,95,0.08) 0%, transparent 70%)',
        }}
      />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] mb-6">
            <span className="text-xs font-medium text-mint uppercase tracking-wide">Интеграции</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-black mb-4 tracking-tight">
            Подключено к государственным<br />
            <span className="gradient-text">и банковским системам</span>
          </h2>
          <p className="text-[#8BA89E] max-w-xl mx-auto text-base md:text-lg">
            Платформа работает в рамках российского регулирования: ФГИС, ЭДО, 152-ФЗ.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {integrations.map((int) => {
            const st = statusLabel[int.status];
            return (
              <div key={int.name} className="card-glass rounded-2xl p-5 transition-all duration-300 hover:translate-y-[-2px]">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-sm font-bold text-[#EAF1EE]">{int.name}</h3>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${st.color}`}>
                    {st.label}
                  </span>
                </div>
                <p className="text-xs text-[#4A6B5E]">{int.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Disclaimer */}
        <p className="mt-8 text-center text-xs text-[#4A6B5E]">
          Sandbox — данные симулированы, интеграция подтверждается в рамках управляемого пилота.
          Live — реальная внешняя система подключена и проверена.
        </p>
      </div>
    </section>
  );
}
