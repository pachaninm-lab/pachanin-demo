const stats = [
  { value: '118М ₽', label: 'объём в пилоте', sub: 'Тамбовская обл.' },
  { value: '8.3 дн', label: 'средний цикл сделки', sub: 'от договора до расчёта' },
  { value: '12', label: 'ролевых модулей', sub: 'покрывают всю цепочку' },
  { value: '0%', label: 'просрочек', sub: 'по данным пилота' },
  { value: '1.8%', label: 'комиссия платформы', sub: 'с исполненной сделки' },
  { value: '6', label: 'регионов', sub: 'в активных сделках' },
];

export default function Stats() {
  return (
    <section className="relative py-16 border-y border-[rgba(126,242,196,0.08)]">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(10,122,95,0.05) 0%, transparent 100%)',
        }}
      />
      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6 md:gap-8">
          {stats.map((s) => (
            <div key={s.value} className="text-center">
              <div className="text-2xl md:text-3xl font-black gradient-text mb-1">{s.value}</div>
              <div className="text-xs md:text-sm font-medium text-[#EAF1EE] mb-0.5">{s.label}</div>
              <div className="text-xs text-[#4A6B5E]">{s.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
