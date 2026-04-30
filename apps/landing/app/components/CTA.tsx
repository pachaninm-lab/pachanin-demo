export default function CTA() {
  return (
    <section id="cta" className="py-24 relative overflow-hidden">
      {/* Glow background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 80% at 50% 50%, rgba(10,122,95,0.2) 0%, transparent 70%)',
        }}
      />
      <div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-6 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />
          <span className="text-xs font-medium text-mint tracking-wide">Открыт набор в управляемый пилот</span>
        </div>

        <h2 className="text-4xl md:text-6xl font-black mb-6 tracking-tight text-balance">
          Готовы перевести<br />
          <span className="gradient-text">сделки в цифровой контур?</span>
        </h2>

        <p className="text-[#8BA89E] text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
          Оставьте заявку — команда свяжется с вами для демонстрации платформы
          и обсуждения условий участия в пилоте.
        </p>

        {/* Form */}
        <div className="card-glass rounded-2xl p-8 max-w-xl mx-auto mb-8 glow">
          <div className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-medium text-[#8BA89E] mb-1.5">Имя и компания</label>
              <input
                type="text"
                placeholder="Иван Иванов, ООО «Агро»"
                className="w-full bg-[rgba(126,242,196,0.04)] border border-[rgba(126,242,196,0.12)] rounded-lg px-4 py-3 text-sm text-[#EAF1EE] placeholder-[#4A6B5E] focus:outline-none focus:border-[rgba(126,242,196,0.35)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8BA89E] mb-1.5">Телефон или e-mail</label>
              <input
                type="text"
                placeholder="+7 (000) 000-00-00 или info@company.ru"
                className="w-full bg-[rgba(126,242,196,0.04)] border border-[rgba(126,242,196,0.12)] rounded-lg px-4 py-3 text-sm text-[#EAF1EE] placeholder-[#4A6B5E] focus:outline-none focus:border-[rgba(126,242,196,0.35)] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8BA89E] mb-1.5">Роль в цепочке</label>
              <select className="w-full bg-[rgba(126,242,196,0.04)] border border-[rgba(126,242,196,0.12)] rounded-lg px-4 py-3 text-sm text-[#8BA89E] focus:outline-none focus:border-[rgba(126,242,196,0.35)] transition-colors appearance-none">
                <option value="">Выберите роль...</option>
                <option>Покупатель (агрохолдинг / трейдер)</option>
                <option>Продавец (фермер / КФХ)</option>
                <option>Логистика / Перевозчик</option>
                <option>Элеватор / Зернохранилище</option>
                <option>Банк / Финансовая организация</option>
                <option>Инвестор</option>
              </select>
            </div>
            <button className="w-full py-4 rounded-xl bg-brand hover:bg-brand-hover text-white font-semibold text-base transition-all glow hover:scale-[1.01] active:scale-[0.99]">
              Запросить демо-доступ →
            </button>
          </div>
          <p className="text-xs text-[#4A6B5E] mt-4 text-center">
            Нажимая кнопку, вы соглашаетесь с обработкой персональных данных в соответствии с 152-ФЗ
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 max-w-sm mx-auto mb-8">
          <div className="flex-1 h-px bg-[rgba(126,242,196,0.1)]" />
          <span className="text-xs text-[#4A6B5E]">или</span>
          <div className="flex-1 h-px bg-[rgba(126,242,196,0.1)]" />
        </div>

        <p className="text-sm text-[#8BA89E]">
          Напишите напрямую:{' '}
          <a href="mailto:info@prozprice.demo" className="text-mint hover:underline">
            info@prozprice.demo
          </a>
          {' '}·{' '}
          <a href="tel:+70000000000" className="text-mint hover:underline">
            +7 (000) 000-00-00
          </a>
        </p>
      </div>
    </section>
  );
}
