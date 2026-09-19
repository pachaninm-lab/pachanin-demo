const trustItems = [
  {
    icon: '🔐',
    title: 'Защита по 152-ФЗ',
    desc: 'Персональные данные обрабатываются в соответствии с законодательством РФ. Раздельное хранение, шифрование, минимизация.',
  },
  {
    icon: '📋',
    title: 'Неизменяемый аудит-лог',
    desc: 'Каждое действие в системе фиксируется с меткой времени. Доказательная база для судебного и банковского арбитража.',
  },
  {
    icon: '🔑',
    title: 'Ролевая модель доступа',
    desc: 'Каждый участник видит только своё. RBAC на уровне модуля, сделки и документа. Без утечки данных между контрагентами.',
  },
  {
    icon: '🛡️',
    title: 'Anti-bypass механизм',
    desc: 'Система препятствует уходу сделки в мессенджеры: прогрессивное маскирование контактов, стимулы для работы внутри платформы.',
  },
];

const regions = [
  { name: 'Тамбовская', deals: 8, sum: '38.4М ₽' },
  { name: 'Воронежская', deals: 7, sum: '32.1М ₽' },
  { name: 'Курская', deals: 5, sum: '22.1М ₽' },
  { name: 'Белгородская', deals: 4, sum: '17.2М ₽' },
  { name: 'Ставропольский кр.', deals: 4, sum: '43.5М ₽' },
  { name: 'Ростовская', deals: 3, sum: '12.6М ₽' },
];

export default function Trust() {
  return (
    <section className="py-24 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Trust */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] mb-6">
              <span className="text-xs font-medium text-mint uppercase tracking-wide">Безопасность</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">
              Платформа, которой<br />
              <span className="gradient-text">доверяет банк</span>
            </h2>
            <p className="text-[#8BA89E] mb-8 text-sm md:text-base leading-relaxed">
              Цепочка доказательств встроена в каждую сделку — не как дополнение, а как основа контура.
            </p>
            <div className="space-y-4">
              {trustItems.map((t) => (
                <div key={t.title} className="flex gap-4 card-glass rounded-xl p-4">
                  <span className="text-xl shrink-0">{t.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-[#EAF1EE] mb-1">{t.title}</h3>
                    <p className="text-xs text-[#8BA89E] leading-relaxed">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Regional coverage */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] mb-6">
              <span className="text-xs font-medium text-mint uppercase tracking-wide">Регионы пилота</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">
              Активные сделки<br />
              <span className="gradient-text">по регионам</span>
            </h2>
            <p className="text-[#8BA89E] mb-8 text-sm md:text-base leading-relaxed">
              Пилот охватывает зерновой пояс России с фокусом на Тамбовскую область как первый управляемый контур.
            </p>
            <div className="card-glass rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[rgba(126,242,196,0.07)] grid grid-cols-3 text-xs font-semibold text-[#4A6B5E]">
                <span>Регион</span>
                <span className="text-center">Сделок</span>
                <span className="text-right">Объём</span>
              </div>
              <div className="divide-y divide-[rgba(126,242,196,0.04)]">
                {regions.map((r, i) => (
                  <div key={r.name} className="px-4 py-3 grid grid-cols-3 items-center text-sm hover:bg-[rgba(126,242,196,0.02)]">
                    <div className="flex items-center gap-2">
                      {i === 0 && <span className="w-1.5 h-1.5 rounded-full bg-mint shrink-0" />}
                      {i > 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#4A6B5E] shrink-0" />}
                      <span className="text-[#EAF1EE] text-xs">{r.name}</span>
                    </div>
                    <span className="text-center text-[#8BA89E] text-xs">{r.deals}</span>
                    <span className="text-right font-mono text-xs text-mint">{r.sum}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-[rgba(126,242,196,0.07)] grid grid-cols-3 text-xs font-bold">
                <span className="text-[#EAF1EE]">Итого</span>
                <span className="text-center text-mint">31</span>
                <span className="text-right font-mono text-mint">118М ₽</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
