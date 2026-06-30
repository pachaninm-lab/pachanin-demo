import { ArrowRight, Banknote, ClipboardCheck, FileCheck2, FlaskConical, Scale, ShieldCheck, Truck, type LucideIcon } from 'lucide-react';

type IntelligenceItem = { title: string; text: string; Icon: LucideIcon };
type AnchorItem = { label: string; title: string; text: string };

const items: IntelligenceItem[] = [
  { title: 'Видит место остановки', text: 'Показывает, где сделка требует действия: рейс, вес, качество, документ, расчёт или спор.', Icon: ShieldCheck },
  { title: 'Фиксирует следующий шаг', text: 'Связывает задачу с ролью участника: продавец, покупатель, логистика, элеватор, лаборатория, банк или арбитр.', Icon: ArrowRight },
  { title: 'Собирает основание', text: 'Факты исполнения, документы и статусы складываются в проверяемую базу для расчёта и разбора расхождений.', Icon: Banknote },
];

const anchors: AnchorItem[] = [
  { label: 'Приёмка', title: 'вес и факт поставки', text: 'элеватор фиксирует исполнение' },
  { label: 'Качество', title: 'показатели партии', text: 'лаборатория даёт основание' },
  { label: 'Документы', title: 'СДИЗ, ЭДО, акты', text: 'комплект связан с событиями' },
  { label: 'Расчёт', title: 'основание для оплаты', text: 'деньги выпускаются по фактам' },
  { label: 'Спор', title: 'расхождения сторон', text: 'разбор идёт по следу сделки' },
  { label: 'Доказательства', title: 'единый пакет фактов', text: 'решение опирается на данные' },
];

export function PlatformV7IntelligenceStrip() {
  return (
    <section id='intelligence' className='entry-section entry-intelligence-section' aria-labelledby='intelligence-title'>
      <style>{css}</style>
      <div className='entry-intelligence-panel'>
        <div className='entry-intelligence-main'>
          <span className='entry-section-kicker'>Контур исполнения после цены</span>
          <h2 id='intelligence-title'>Сделка не заканчивается на согласованной цене</h2>
          <p>Главный риск начинается дальше: рейс, приёмка, качество, документы, расчёт, спор и доказательства должны быть связаны в один проверяемый процесс.</p>
        </div>

        <div className='entry-intelligence-flow' aria-label='Ключевые этапы исполнения зерновой сделки'>
          <span>Цена</span><i /><span>Рейс</span><i /><span>Приёмка</span><i /><span>Расчёт</span>
        </div>

        <div className='entry-intelligence-grid'>
          {items.map((item) => <IntelligenceTile key={item.title} item={item} />)}
        </div>

        <div className='entry-execution-anchors' aria-label='Что удерживает сделку внутри контура исполнения'>
          {anchors.map((item) => <ExecutionAnchor key={item.label} item={item} />)}
        </div>
      </div>
    </section>
  );
}

function IntelligenceTile({ item }: { item: IntelligenceItem }) {
  const Icon = item.Icon;
  return <article className='entry-intelligence-tile'><span><Icon size={20} strokeWidth={2.25} /></span><strong>{item.title}</strong><small>{item.text}</small></article>;
}

function ExecutionAnchor({ item }: { item: AnchorItem }) {
  return <article className='entry-execution-anchor'><strong>{item.label}</strong><span>{item.title}</span><small>{item.text}</small></article>;
}

const css = `
.entry-intelligence-section { padding-top: 8px; }
.entry-intelligence-panel { position: relative; display: grid; grid-template-columns: 1.02fr .78fr 1.12fr; gap: 14px; align-items: stretch; padding: 16px; border-radius: 30px; border: 1px solid rgba(0,122,47,.12); background: linear-gradient(135deg, rgba(255,255,255,.92), rgba(246,250,245,.94)); box-shadow: 0 18px 48px rgba(7,22,17,.07); overflow: hidden; }
.entry-intelligence-panel::before { content: ''; position: absolute; left: 18px; right: 18px; top: 50%; height: 1px; background: linear-gradient(90deg, transparent, rgba(0,122,47,.22), transparent); animation: entrySoftScan 6s ease-in-out infinite; }
.entry-intelligence-panel::after { content: ''; position: absolute; inset: auto -80px -120px auto; width: 260px; height: 260px; border-radius: 999px; background: radial-gradient(circle, rgba(0,122,47,.10), transparent 64%); pointer-events: none; }
.entry-intelligence-main, .entry-intelligence-flow, .entry-intelligence-grid, .entry-execution-anchors { position: relative; z-index: 1; }
.entry-intelligence-main { padding: 20px; border-radius: 23px; background: rgba(255,255,255,.80); border: 1px solid rgba(7,22,17,.06); }
.entry-intelligence-main h2 { margin: 0; font-size: clamp(25px, 2.4vw, 38px); line-height: 1.04; letter-spacing: -.047em; font-weight: 950; }
.entry-intelligence-main p { margin: 12px 0 0; color: #5c6862; font-size: 14.5px; line-height: 1.44; font-weight: 650; }
.entry-intelligence-flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr; align-items: center; gap: 8px; padding: 18px; border-radius: 23px; background: rgba(7,65,46,.05); }
.entry-intelligence-flow span { display: grid; place-items: center; min-height: 44px; border-radius: 16px; background: #fff; color: #153028; font-size: 12px; font-weight: 950; box-shadow: 0 10px 24px rgba(7,22,17,.055); animation: entrySoftStep 7.2s ease-in-out infinite; }
.entry-intelligence-flow span:nth-of-type(2) { animation-delay: .45s; }
.entry-intelligence-flow span:nth-of-type(3) { animation-delay: .9s; }
.entry-intelligence-flow span:nth-of-type(4) { animation-delay: 1.35s; }
.entry-intelligence-flow i { width: 18px; height: 2px; border-radius: 999px; background: rgba(0,122,47,.34); animation: entrySoftBlink 2.8s ease-in-out infinite; }
.entry-intelligence-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.entry-intelligence-tile { min-height: 154px; padding: 16px; border-radius: 22px; display: grid; align-content: start; gap: 9px; border: 1px solid rgba(7,22,17,.075); background: rgba(255,255,255,.82); box-shadow: 0 14px 34px rgba(7,22,17,.06); }
.entry-intelligence-tile span { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 15px; color: #087a3b; background: rgba(0,122,47,.08); animation: entrySoftIcon 7.2s ease-in-out infinite; }
.entry-intelligence-tile:nth-child(2) span { animation-delay: .55s; }
.entry-intelligence-tile:nth-child(3) span { animation-delay: 1.1s; }
.entry-intelligence-tile strong { color: #071611; font-size: 16px; font-weight: 950; letter-spacing: -.03em; }
.entry-intelligence-tile small { color: #65716b; font-size: 12.5px; line-height: 1.34; font-weight: 650; }
.entry-execution-anchors { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 9px; }
.entry-execution-anchor { min-height: 104px; padding: 14px; border-radius: 20px; border: 1px solid rgba(7,22,17,.07); background: linear-gradient(180deg, rgba(255,255,255,.86), rgba(249,252,248,.78)); box-shadow: 0 12px 28px rgba(7,22,17,.045); }
.entry-execution-anchor strong { display: block; color: #087a3b; font-size: 13px; font-weight: 950; letter-spacing: -.02em; }
.entry-execution-anchor span { display: block; margin-top: 7px; color: #12261f; font-size: 13px; line-height: 1.18; font-weight: 900; }
.entry-execution-anchor small { display: block; margin-top: 7px; color: #65716b; font-size: 11.5px; line-height: 1.28; font-weight: 650; }
@keyframes entrySoftScan { 0%,100% { opacity: .24; transform: translateX(-4%); } 50% { opacity: .6; transform: translateX(4%); } }
@keyframes entrySoftBlink { 0%,100% { opacity: .35; } 50% { opacity: .95; } }
@keyframes entrySoftStep { 0%, 86%, 100% { transform: translateY(0); box-shadow: 0 10px 24px rgba(7,22,17,.055); } 43% { transform: translateY(-2px); box-shadow: 0 16px 30px rgba(0,122,47,.10); } }
@keyframes entrySoftIcon { 0%, 86%, 100% { transform: scale(1); } 43% { transform: scale(1.05); } }
@media (prefers-reduced-motion: reduce) { .entry-intelligence-panel::before, .entry-intelligence-flow span, .entry-intelligence-flow i, .entry-intelligence-tile span { animation: none; } }
@media (max-width: 1180px) { .entry-execution-anchors { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 980px) { .entry-intelligence-panel { grid-template-columns: 1fr; padding: 12px; border-radius: 26px; } .entry-intelligence-flow { overflow-x: auto; } .entry-intelligence-grid { grid-template-columns: 1fr; } .entry-intelligence-tile { min-height: 120px; } .entry-execution-anchors { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 520px) { .entry-execution-anchors { grid-template-columns: 1fr; } }
@media (max-width: 420px) { .entry-intelligence-flow { grid-template-columns: 1fr; } .entry-intelligence-flow i { width: 2px; height: 16px; justify-self: center; } }
`;
