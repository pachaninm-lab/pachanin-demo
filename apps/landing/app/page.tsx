import LandingHero from './components/LandingHero';
import PilotLeadForm from './components/PilotLeadForm';
import PremiumMockups from './components/PremiumMockups';

const pains = [
  ['Цена уже согласована', 'Но деньги ещё можно потерять на рейсе, весе, качестве, документах и удержаниях.'],
  ['Факты разбросаны', 'Звонки, фото, лаборатория, ЭДО, СДИЗ и расчёт живут отдельно друг от друга.'],
  ['Спор начинается поздно', 'Когда нет единого следа сделки, стороны спорят не по фактам, а по перепискам.'],
];

const roles = [
  ['Продавец', 'понимает, что мешает выпуску денег'],
  ['Покупатель', 'видит фактическое исполнение до оплаты'],
  ['Логистика', 'держит рейс, маршрут и документы в одном контуре'],
  ['Элеватор', 'фиксирует приёмку без разрыва с документами'],
  ['Финансирование', 'видит основание для резерва, удержания и выпуска'],
  ['Регион', 'видит узкие места сделки и спорность'],
];

const pilot = ['реальная цепочка сторон', 'маршрут от цены до денег', 'спор по весу или качеству', 'документы и ЭДО', 'ручной труд и ошибки', 'точки будущей автоматизации'];

export default function Home() {
  return (
    <main className="premium-surface relative overflow-hidden bg-[#030D0A] text-[#EAF1EE]">
      <header className="premium-nav fixed inset-x-0 top-0 z-50 border-b border-[rgba(126,242,196,0.08)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <a href="#top" className="flex items-center gap-3" aria-label="Прозрачная Цена">
            <span className="glow-sm flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-xs font-black text-mint">ПЦ</span>
            <span className="text-sm font-bold tracking-tight">Прозрачная <span className="text-mint">Цена</span></span>
          </a>
          <nav className="hidden items-center gap-7 md:flex">
            <a href="#problem" className="text-sm text-[#8BA89E] hover:text-white">Боль</a>
            <a href="#mockup" className="text-sm text-[#8BA89E] hover:text-white">Мокапы</a>
            <a href="#pilot" className="text-sm text-[#8BA89E] hover:text-white">Пилот</a>
            <a href="#contact" className="lux-button rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-hover">Оставить заявку</a>
          </nav>
          <a href="#contact" className="lux-button rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white md:hidden">Пилот</a>
        </div>
      </header>

      <LandingHero />

      <section className="lux-line relative z-10 border-y border-[rgba(126,242,196,0.08)] py-9">
        <div className="mx-auto grid max-w-7xl gap-3 px-6 md:grid-cols-4">
          {['Не marketplace', 'Не фейковый production', 'Деньги связаны с фактами', 'Заявка за 60 секунд'].map((item) => (
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

      <PremiumMockups />

      <section className="relative z-10 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 max-w-3xl">
            <div className="mb-5 inline-flex rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-mint">кому это нужно</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Каждый участник теряет в своём месте.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roles.map(([role, text]) => (
              <div key={role} className="premium-card rounded-2xl p-6 transition hover:-translate-y-1">
                <h3 className="mb-2 text-lg font-bold text-white">{role}</h3>
                <p className="text-sm leading-relaxed text-[#8BA89E]">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pilot" className="lux-line relative z-10 py-24 grid-bg">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-[rgba(245,180,30,0.24)] bg-[rgba(245,180,30,0.06)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[#F5B41E]">controlled pilot</div>
            <h2 className="mb-5 text-3xl font-black tracking-tight md:text-5xl">Сначала одна сделка, которую нельзя потерять.</h2>
            <p className="text-lg leading-relaxed text-[#8BA89E]">Проверяем слабые места на реальной цепочке: кто вводит данные, кто задерживает документы, где спорят о качестве, как деньги проходят через удержания.</p>
          </div>
          <div className="premium-panel rounded-3xl p-6">
            <div className="space-y-3">
              {pilot.map((item, index) => (
                <div key={item} className="flow-dot flex gap-3 rounded-xl border border-[rgba(126,242,196,0.07)] bg-[#111C19] p-4 pr-10">
                  <span className="font-mono text-xs text-mint">{index + 1}</span>
                  <span className="text-sm text-[#C9D8D2]">{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-[rgba(245,180,30,0.18)] bg-[rgba(245,180,30,0.06)] p-4 text-sm leading-relaxed text-[#D7C895]">ФГИС «Зерно», СДИЗ, ЭДО, ЭТрН, банк и 1С не заявляются как завершённые без доступа, договора и проверки.</div>
          </div>
        </div>
      </section>

      <section id="contact" className="relative z-10 overflow-hidden py-24">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[rgba(126,242,196,0.2)] bg-[rgba(126,242,196,0.05)] px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            <span className="text-xs font-semibold uppercase tracking-wide text-mint">следующий шаг</span>
          </div>
          <h2 className="mb-6 text-4xl font-black tracking-tight md:text-6xl">Покажите сделку, где сейчас есть риск.</h2>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-[#8BA89E]">Маршрут, документы, оплата, спор по качеству, задержка на приёмке, удержание денег. На конкретной сделке сразу видно, нужен ли контур.</p>
          <PilotLeadForm />
        </div>
      </section>

      <footer className="relative z-10 border-t border-[rgba(126,242,196,0.08)] py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="font-bold text-white">Прозрачная <span className="text-mint">Цена</span></div>
            <div className="mt-1 text-sm text-[#4A6B5E]">контур исполнения внебиржевой зерновой сделки</div>
          </div>
          <div className="max-w-xl text-xs leading-relaxed text-[#4A6B5E] md:text-right">Предпилотная версия. Сайт не является публичной офертой, банковской гарантией или подтверждением завершённых боевых интеграций.</div>
        </div>
      </footer>
    </main>
  );
}
