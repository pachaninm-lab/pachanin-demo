import FortyEightHourResult from './components/FortyEightHourResult';
import HeaderLogo from './components/HeaderLogo';
import LandingHero from './components/LandingHero';
import LossMap from './components/LossMap';
import PilotLeadForm from './components/PilotLeadForm';
import PilotSingleDeal from './components/PilotSingleDeal';
import PremiumMockups from './components/PremiumMockups';
import RoleEntry from './components/RoleEntry';
import StickyCTA from './components/StickyCTA';

const navLinks = [
  ['Проблема', '#problem'],
  ['Карта', '#loss-map'],
  ['Роли', '#roles'],
  ['Экран', '#mockup'],
  ['Пилот', '#pilot'],
];

const pains = [
  ['Исполнение', 'Цена уже согласована, но рейс, вес, качество и приёмка ещё могут изменить итоговую сумму.'],
  ['Документы', 'СДИЗ, ЭДО, УПД и транспортные документы часто закрываются позже самой поставки.'],
  ['Деньги', 'Выпуск средств должен идти не по переписке, а по подтверждённым событиям сделки.'],
];

function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-[18px] w-[18px]"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.35 1.9.66 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.31 1.84.53 2.8.66A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="premium-surface relative overflow-hidden bg-[#030D0A] pb-24 text-[#EAF1EE] md:pb-0">
      <header className="premium-nav fixed inset-x-0 top-0 z-50 border-b border-[rgba(126,242,196,0.10)] bg-[#030D0A]/92 shadow-[0_20px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
        <div className="mx-auto flex h-[78px] max-w-7xl items-center justify-between px-5 md:px-6">
          <a href="#top" className="flex min-w-0 items-center gap-3" aria-label="Прозрачная Цена">
            <HeaderLogo />
            <span className="min-w-0 text-lg font-black tracking-tight text-white md:text-xl">
              Прозрачная <span className="text-mint">Цена</span>
              <span className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6F8C82] lg:block">контроль сделки от цены до денег</span>
            </span>
          </a>
          <nav className="hidden items-center gap-3 md:flex">
            {navLinks.map(([label, href]) => (
              <a key={href} href={href} className="text-sm font-semibold text-[#8BA89E] transition hover:text-white">{label}</a>
            ))}
            <a
              href="tel:+79162778989"
              aria-label="Позвонить"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[rgba(126,242,196,0.16)] bg-[rgba(255,255,255,0.03)] text-white transition hover:border-[rgba(126,242,196,0.32)] hover:bg-[rgba(126,242,196,0.08)]"
            >
              <PhoneIcon />
            </a>
            <a href="#contact" className="lux-button rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-hover">Оставить заявку</a>
          </nav>
          <div className="flex items-center gap-2 md:hidden">
            <a
              href="tel:+79162778989"
              aria-label="Позвонить"
              className="flex h-12 w-12 items-center justify-center rounded-xl border border-[rgba(126,242,196,0.16)] bg-[rgba(255,255,255,0.03)] text-white"
            >
              <PhoneIcon />
            </a>
            <a href="#contact" className="lux-button rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white">Заявка</a>
          </div>
        </div>
      </header>

      <LandingHero />

      <section id="problem" className="relative z-10 scroll-mt-28 py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-10 max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-[rgba(255,139,144,0.24)] bg-[rgba(255,139,144,0.05)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#FF8B90]">где ломается сделка</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Рынок теряет деньги не на поиске цены, а после неё.</h2>
            <p className="text-lg leading-relaxed text-[#8BA89E]">Платформа нужна там, где сделку надо довести до оплаты, документов и доказательств без ручного хаоса.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {pains.map(([title, text], index) => (
              <div key={title} className="premium-card motion-lift rounded-2xl p-6">
                <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(255,139,144,0.18)] bg-[rgba(255,139,144,0.055)] font-mono text-sm font-black text-[#FF8B90]">{index + 1}</div>
                <h3 className="mb-3 text-lg font-black text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-[#8BA89E]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FortyEightHourResult />
      <LossMap />
      <RoleEntry />
      <PremiumMockups />
      <PilotSingleDeal />

      <section id="contact" className="relative z-10 scroll-mt-28 overflow-hidden py-16 md:py-20">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            <span className="text-xs font-bold uppercase tracking-wide text-mint">следующий шаг</span>
          </div>
          <h2 className="mb-6 text-4xl font-black tracking-tight md:text-6xl">Покажем, где в вашей сделке зависают деньги.</h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[#8BA89E]">Опишите одну сделку. Заявка уйдёт отдельным письмом на Gmail.</p>
          <PilotLeadForm />
        </div>
      </section>

      <footer className="relative z-10 border-t border-[rgba(126,242,196,0.08)] py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-bold text-white">Прозрачная <span className="text-mint">Цена</span></div>
            <div className="mt-1 text-sm text-[#4A6B5E]">контур исполнения внебиржевой зерновой сделки</div>
          </div>
          <div className="max-w-xl text-xs leading-relaxed text-[#4A6B5E] md:text-right">Предпилотная версия. Сайт не является публичной офертой, банковской гарантией, официальным заявлением Сбера или Минсельхоза, либо подтверждением завершённых боевых интеграций.</div>
        </div>
      </footer>

      <StickyCTA />
    </main>
  );
}
