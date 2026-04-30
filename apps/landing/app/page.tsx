import AgroScenarios from './components/AgroScenarios';
import FortyEightHourResult from './components/FortyEightHourResult';
import LandingHero from './components/LandingHero';
import LandingTrustBlocks from './components/LandingTrustBlocks';
import LossMap from './components/LossMap';
import NotAnotherTool from './components/NotAnotherTool';
import PilotLeadForm from './components/PilotLeadForm';
import PilotSingleDeal from './components/PilotSingleDeal';
import PremiumMockups from './components/PremiumMockups';
import RoleEntry from './components/RoleEntry';
import SampleLossCard from './components/SampleLossCard';
import StickyCTA from './components/StickyCTA';

const navLinks = [
  ['Суть', '#top'],
  ['Потери', '#loss-map'],
  ['Роли', '#roles'],
  ['Деньги', '#money'],
  ['Сбер / AI', '#trust'],
  ['Пилот', '#pilot-chain'],
  ['Заявка', '#contact'],
];

const pains = [
  ['Цена уже согласована', 'Но деньги ещё можно потерять на рейсе, весе, качестве, документах и удержаниях.'],
  ['Факты разбросаны', 'Звонки, фото, лаборатория, ЭДО, СДИЗ и расчёт живут отдельно друг от друга.'],
  ['Спор начинается поздно', 'Когда нет единого следа сделки, стороны спорят не по фактам, а по перепискам.'],
];

export default function Home() {
  return (
    <main className="premium-surface relative overflow-hidden bg-[#030D0A] pb-24 text-[#EAF1EE] md:pb-0">
      <header className="premium-nav fixed inset-x-0 top-0 z-50 border-b border-[rgba(126,242,196,0.10)] bg-[#030D0A]/92 shadow-[0_20px_70px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
        <div className="mx-auto flex h-[78px] max-w-7xl items-center justify-between px-5 md:px-6">
          <a href="#top" className="flex min-w-0 items-center gap-3" aria-label="Прозрачная Цена">
            <span className="brand-logo-mark glow-sm flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-xs font-black text-mint">ПЦ</span>
            <span className="min-w-0 text-lg font-black tracking-tight text-white md:text-xl">
              Прозрачная <span className="text-mint">Цена</span>
              <span className="mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6F8C82] lg:block">контур исполнения сделки</span>
            </span>
          </a>

          <nav className="hidden items-center gap-6 md:flex">
            {navLinks.slice(1, -1).map(([label, href]) => (
              <a key={href} href={href} className="text-sm font-medium text-[#8BA89E] transition hover:text-white">{label}</a>
            ))}
            <a href="#contact" className="lux-button rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover">Хочу протестировать</a>
          </nav>

          <details className="group md:hidden [&>summary::-webkit-details-marker]:hidden">
            <summary className="flex h-12 w-12 cursor-pointer list-none items-center justify-center rounded-2xl border border-[rgba(126,242,196,0.20)] bg-[rgba(126,242,196,0.055)] text-mint shadow-[0_0_30px_rgba(126,242,196,0.08)] transition hover:border-[rgba(126,242,196,0.38)]" aria-label="Открыть меню">
              <span className="relative h-4 w-5">
                <span className="absolute left-0 top-0 h-0.5 w-5 rounded-full bg-current transition group-open:top-2 group-open:rotate-45" />
                <span className="absolute left-0 top-2 h-0.5 w-5 rounded-full bg-current transition group-open:opacity-0" />
                <span className="absolute bottom-0 left-0 h-0.5 w-5 rounded-full bg-current transition group-open:bottom-1.5 group-open:-rotate-45" />
              </span>
            </summary>
            <div className="fixed left-4 right-4 top-[92px] z-50 max-h-[calc(100vh-120px)] overflow-y-auto rounded-[28px] border border-[rgba(126,242,196,0.18)] bg-[#04100D]/[0.99] p-3 shadow-[0_34px_110px_rgba(0,0,0,0.72)] backdrop-blur-2xl">
              <div className="border-b border-[rgba(126,242,196,0.08)] px-3 pb-3 pt-2 text-[10px] font-black uppercase tracking-[0.20em] text-mint">Навигация по лендингу</div>
              <div className="grid gap-1 py-2">
                {navLinks.map(([label, href]) => (
                  <a key={href} href={href} className="flex items-center justify-between rounded-2xl px-3 py-3 text-sm font-bold text-[#DDE8E3] transition hover:bg-[rgba(126,242,196,0.08)] hover:text-white">
                    <span>{label}</span>
                    <span className="text-[#35584C]">→</span>
                  </a>
                ))}
              </div>
              <a href="#contact" className="lux-button mt-1 block rounded-2xl bg-brand px-4 py-3 text-center text-sm font-black text-white">Хочу протестировать</a>
            </div>
          </details>
        </div>
      </header>

      <LandingHero />

      <section id="problem" className="relative z-10 scroll-mt-28 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-[rgba(255,139,144,0.24)] bg-[rgba(255,139,144,0.05)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#FF8B90]">где рынок теряет деньги</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">На бумаге сделка закрыта. В жизни она только началась.</h2>
            <p className="text-lg leading-relaxed text-[#8BA89E]">Когда партия не совпала по весу, качество упало, водитель опоздал или пакет документов неполный, переписка перестаёт быть управлением.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {pains.map(([title, text]) => (
              <div key={title} className="premium-card rounded-2xl p-6 transition hover:-translate-y-1">
                <h3 className="mb-3 text-lg font-bold text-white">{title}</h3>
                <p className="text-sm leading-relaxed text-[#8BA89E]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <FortyEightHourResult />
      <LossMap />
      <AgroScenarios />
      <RoleEntry />
      <PremiumMockups />
      <LandingTrustBlocks />
      <NotAnotherTool />
      <PilotSingleDeal />
      <SampleLossCard />

      <section id="contact" className="relative z-10 scroll-mt-28 overflow-hidden py-24">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            <span className="text-xs font-semibold uppercase tracking-wide text-mint">следующий шаг</span>
          </div>
          <h2 className="mb-6 text-4xl font-black tracking-tight md:text-6xl">Получите карту потерь по вашей сделке.</h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[#8BA89E]">Опишите одну сделку: культура, объём, маршрут, приёмка, документы, оплата или спор. Ответим с фокусом на деньги, факты, Сбер-контур, AI-риски и пилот.</p>
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
