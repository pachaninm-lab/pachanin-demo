import FortyEightHourResult from './components/FortyEightHourResult';
import HeaderLogo from './components/HeaderLogo';
import InterestChat from './components/InterestChat';
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
  ['Интерес', '#interest'],
  ['Экран', '#mockup'],
  ['Пилот', '#pilot'],
];

const pains = [
  ['Исполнение', 'Цена уже согласована, но рейс, вес, качество и приёмка ещё могут изменить итоговую сумму.'],
  ['Документы', 'СДИЗ, ЭДО, УПД и транспортные документы часто закрываются позже самой поставки.'],
  ['Деньги', 'Выпуск средств должен идти не по переписке, а по подтверждённым событиям сделки.'],
];

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
          <nav className="hidden items-center gap-5 md:flex">
            {navLinks.map(([label, href]) => (
              <a key={href} href={href} className="text-sm font-semibold text-[#8BA89E] transition hover:text-white">{label}</a>
            ))}
            <a href="#interest" className="lux-button rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-hover">Пройти мини-чат</a>
          </nav>
          <a href="#interest" className="lux-button rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white md:hidden">Мини-чат</a>
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
      <InterestChat />
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
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[#8BA89E]">Опишите одну сделку. В ответ соберём короткую карту риска: рейс, качество, документы, оплата или спор.</p>
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
