const footerLinks = {
  Платформа: ['Control Tower', 'Сделки', 'Кабинет покупателя', 'Кабинет продавца', 'Логистика', 'Споры'],
  Участники: ['Агрохолдинги', 'Фермеры и КФХ', 'Перевозчики', 'Элеваторы', 'Банки', 'Инвесторы'],
  Компания: ['О платформе', 'Пилот', 'Безопасность', 'Интеграции', 'Контакты'],
};

export default function Footer() {
  return (
    <footer className="relative border-t border-[rgba(126,242,196,0.08)] py-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 13L8 3L13 13" stroke="#7EF2C4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M5 9.5H11" stroke="#7EF2C4" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <span className="font-bold text-[15px] text-white">
                Прозрачная<span className="text-mint"> Цена</span>
              </span>
            </div>
            <p className="text-sm text-[#4A6B5E] leading-relaxed mb-4 max-w-xs">
              Цифровой контур исполнения внебиржевой зерновой сделки. Цена, логистика, приёмка, документы и деньги — в одной системе.
            </p>
            <p className="text-xs text-[#4A6B5E]">
              ООО «Прозрачная Цена»<br />
              Тамбовская область
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([section, links]) => (
            <div key={section}>
              <h4 className="text-xs font-semibold text-[#EAF1EE] uppercase tracking-wider mb-4">
                {section}
              </h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-[#4A6B5E] hover:text-[#8BA89E] transition-colors">
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-[rgba(126,242,196,0.06)] flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#4A6B5E]">
            © 2024 ООО «Прозрачная Цена». Все права защищены.
          </p>
          <div className="flex items-center gap-6">
            <a href="#" className="text-xs text-[#4A6B5E] hover:text-[#8BA89E] transition-colors">
              Политика конфиденциальности
            </a>
            <a href="#" className="text-xs text-[#4A6B5E] hover:text-[#8BA89E] transition-colors">
              Пользовательское соглашение
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
