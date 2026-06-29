import { ArrowRight, Banknote, FileCheck2, ShieldCheck, type LucideIcon } from 'lucide-react';

type IntelligenceItem = { title: string; text: string; Icon: LucideIcon };

const items: IntelligenceItem[] = [
  { title: 'Находит блокер', text: 'Показывает, где сделка остановилась: рейс, вес, качество, документ или оплата.', Icon: ShieldCheck },
  { title: 'Даёт следующий шаг', text: 'Подсказывает, какая роль должна подтвердить факт или загрузить документ.', Icon: ArrowRight },
  { title: 'Собирает основание', text: 'Связывает события, документы и статусы в понятную базу для расчёта.', Icon: Banknote },
];

export function PlatformV7IntelligenceStrip() {
  return (
    <section id='intelligence' className='entry-section entry-intelligence-section' aria-labelledby='intelligence-title'>
      <style>{css}</style>
      <div className='entry-intelligence-panel'>
        <div className='entry-intelligence-main'>
          <span className='entry-section-kicker'>Интеллект сделки</span>
          <h2 id='intelligence-title'>ИИ-слой работает после этапов сделки</h2>
          <p>Он не заменяет участников. Он спокойно собирает факты по рейсу, приёмке, качеству, документам и оплате — и показывает следующий рабочий шаг.</p>
        </div>

        <div className='entry-intelligence-flow' aria-hidden='true'>
          <span>Цена</span><i /><span>Факт</span><i /><span>Документ</span><i /><span>Оплата</span>
        </div>

        <div className='entry-intelligence-grid'>
          {items.map((item) => <IntelligenceTile key={item.title} item={item} />)}
        </div>
      </div>
    </section>
  );
}

function IntelligenceTile({ item }: { item: IntelligenceItem }) {
  const Icon = item.Icon;
  return <article className='entry-intelligence-tile'><span><Icon size={20} strokeWidth={2.25} /></span><strong>{item.title}</strong><small>{item.text}</small></article>;
}

const css = `
.entry-intelligence-section { padding-top: 8px; }
.entry-intelligence-panel { position: relative; display: grid; grid-template-columns: 1.05fr .82fr 1.18fr; gap: 14px; align-items: stretch; padding: 16px; border-radius: 30px; border: 1px solid rgba(0,122,47,.12); background: linear-gradient(135deg, rgba(255,255,255,.90), rgba(246,250,245,.92)); box-shadow: 0 18px 48px rgba(7,22,17,.07); overflow: hidden; }
.entry-intelligence-panel::before { content: ''; position: absolute; left: 18px; right: 18px; top: 50%; height: 1px; background: linear-gradient(90deg, transparent, rgba(0,122,47,.22), transparent); animation: entrySoftScan 6s ease-in-out infinite; }
.entry-intelligence-main, .entry-intelligence-flow, .entry-intelligence-grid { position: relative; z-index: 1; }
.entry-intelligence-main { padding: 20px; border-radius: 23px; background: rgba(255,255,255,.78); border: 1px solid rgba(7,22,17,.06); }
.entry-intelligence-main h2 { margin: 0; font-size: clamp(25px, 2.4vw, 38px); line-height: 1.04; letter-spacing: -.047em; font-weight: 950; }
.entry-intelligence-main p { margin: 12px 0 0; color: #5c6862; font-size: 14.5px; line-height: 1.44; font-weight: 650; }
.entry-intelligence-flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr; align-items: center; gap: 8px; padding: 18px; border-radius: 23px; background: rgba(7,65,46,.05); }
.entry-intelligence-flow span { display: grid; place-items: center; min-height: 44px; border-radius: 16px; background: #fff; color: #153028; font-size: 12px; font-weight: 950; box-shadow: 0 10px 24px rgba(7,22,17,.055); }
.entry-intelligence-flow i { width: 18px; height: 2px; border-radius: 999px; background: rgba(0,122,47,.34); animation: entrySoftBlink 2.8s ease-in-out infinite; }
.entry-intelligence-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.entry-intelligence-tile { min-height: 154px; padding: 16px; border-radius: 22px; display: grid; align-content: start; gap: 9px; border: 1px solid rgba(7,22,17,.075); background: rgba(255,255,255,.80); box-shadow: 0 14px 34px rgba(7,22,17,.06); }
.entry-intelligence-tile span { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 15px; color: #087a3b; background: rgba(0,122,47,.08); }
.entry-intelligence-tile strong { color: #071611; font-size: 16px; font-weight: 950; letter-spacing: -.03em; }
.entry-intelligence-tile small { color: #65716b; font-size: 12.5px; line-height: 1.34; font-weight: 650; }
@keyframes entrySoftScan { 0%,100% { opacity: .24; transform: translateX(-4%); } 50% { opacity: .6; transform: translateX(4%); } }
@keyframes entrySoftBlink { 0%,100% { opacity: .35; } 50% { opacity: .95; } }
@media (max-width: 980px) { .entry-intelligence-panel { grid-template-columns: 1fr; padding: 12px; border-radius: 26px; } .entry-intelligence-flow { overflow-x: auto; } .entry-intelligence-grid { grid-template-columns: 1fr; } .entry-intelligence-tile { min-height: 120px; } }
@media (max-width: 420px) { .entry-intelligence-flow { grid-template-columns: 1fr; } .entry-intelligence-flow i { width: 2px; height: 16px; justify-self: center; } }
`;
