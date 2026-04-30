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

const pains = [
  ['Цена уже согласована', 'Но деньги ещё можно потерять на рейсе, весе, качестве, документах и удержаниях.'],
  ['Факты разбросаны', 'Звонки, фото, лаборатория, ЭДО, СДИЗ и расчёт живут отдельно друг от друга.'],
  ['Спор начинается поздно', 'Когда нет единого следа сделки, стороны спорят не по фактам, а по перепискам.'],
];

export default function Home() {
  return (
    <main className="premium-surface relative overflow-hidden bg-[#030D0A] pb-24 text-[#EAF1EE] md:pb-0">
      <header className="premium-nav fixed inset-x-0 top-0 z-50 border-b border-[rgba(126,242,196,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <a href="#top" className="flex items-center gap-3" aria-label="Прозрачная Цена">
            <span className="glow-sm flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-xs font-black text-mint">ПЦ</span>
            <span className="text-sm font-bold tracking-tight">Прозрачная <span className="text-mint">Цена</span></span>
          </a>
          <nav className="hidden items-center gap-7 md:flex">
            <a href="#loss-map" className="text-sm text-[#8BA89E] hover:text-white">Где потери</a>
            <a href="#money" className="text-sm text-[#8BA89E] hover:text-white">Деньги</a>
            <a href="#trust" className="text-sm text-[#8BA89E] hover:text-white">Сбер / AI / АПК</a>
            <a href="#sample" className="text-sm text-[#8BA89E] hover:text-white">Пример</a>
            <a href="#contact" className="lux-button rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-hover">Получить карту</a>
          </nav>
          <a href="#contact" className="lux-button rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white md:hidden">Карта</a>
        </div>
      </header>

      <LandingHero />

      <section className="lux-line relative z-10 border-y border-[rgba(126,242,196,0.08)] py-9">
        <div className="mx-auto grid max-w-7xl gap-3 px-6 md:grid-cols-4">
          {['Не marketplace', 'Сбер-контур', 'AI-анализ рисков', 'В повестке цифровизации АПК'].map((item) => (
            <div key={item} className="premium-card rounded-2xl p-4 text-center text-sm font-semibold text-[#C9D8D2]">{item}</div>
          ))}
        </div>
      </section>

      <section id="problem" className="relative z-10 py-24">
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

      <LossMap />
      <RoleEntry />
      <PremiumMockups />
      <LandingTrustBlocks />
      <NotAnotherTool />
      <PilotSingleDeal />
      <SampleLossCard />

      <section id="contact" className="relative z-10 overflow-hidden py-24">
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
