import { ArrowRight, Banknote, FileCheck2, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';

type AiSignal = { title: string; text: string; tag: string; Icon: LucideIcon };

const aiSignals: AiSignal[] = [
  { title: 'Сигнал риска', text: 'Контур подсвечивает, где сделка может остановиться до оплаты.', tag: 'risk scan', Icon: ShieldCheck },
  { title: 'Следующее действие', text: 'Показывает, кто должен подтвердить факт или документ.', tag: 'next step', Icon: ArrowRight },
  { title: 'Доказательный след', text: 'Событие, файл и роль участника связываются в одну цепочку.', tag: 'evidence', Icon: FileCheck2 },
  { title: 'Основание денег', text: 'Видно, что подтверждено, а что ещё мешает расчёту.', tag: 'payment basis', Icon: Banknote },
];

export function PlatformV7AiCommand() {
  return (
    <section id='ai-control' className='entry-section entry-ai-command' aria-labelledby='ai-control-title'>
      <style>{aiCommandCss}</style>
      <div className='entry-section-head entry-ai-head'>
        <div>
          <span className='entry-section-kicker'>AI execution layer</span>
          <h2 id='ai-control-title'>ИИ-диспетчер сделки</h2>
        </div>
        <p>Не витрина и не обычная карусель: на главной показываем живой интеллект сделки — он собирает сигналы из рейса, приёмки, качества, документов и денег.</p>
      </div>

      <div className='entry-ai-stage' aria-label='Анимированный ИИ-контур сделки'>
        <div className='entry-ai-orb' aria-hidden='true'>
          <span className='entry-ai-ring ring-a' />
          <span className='entry-ai-ring ring-b' />
          <span className='entry-ai-ring ring-c' />
          <span className='entry-ai-core'><Sparkles size={34} strokeWidth={2.2} /></span>
          <span className='entry-ai-pulse pulse-a' />
          <span className='entry-ai-pulse pulse-b' />
          <span className='entry-ai-pulse pulse-c' />
        </div>

        <div className='entry-ai-copy'>
          <span>Сделка не просто отображается</span>
          <strong>система подсказывает следующий шаг</strong>
          <p>Где риск? Кто должен подтвердить факт? Какой документ нужен? Что мешает оплате? Ответ должен быть виден сразу, без звонков и ручного расследования.</p>
        </div>

        <div className='entry-ai-signal-grid'>
          {aiSignals.map((signal) => <AiSignalTile key={signal.title} signal={signal} />)}
        </div>
      </div>
    </section>
  );
}

function AiSignalTile({ signal }: { signal: AiSignal }) {
  const Icon = signal.Icon;
  return (
    <article className='entry-ai-signal'>
      <span><Icon size={19} strokeWidth={2.25} /></span>
      <div><strong>{signal.title}</strong><small>{signal.text}</small></div>
      <em>{signal.tag}</em>
    </article>
  );
}

const aiCommandCss = `
.entry-ai-command { padding-top: 12px; }
.entry-ai-head { align-items: start; }
.entry-ai-stage {
  position: relative;
  min-height: 460px;
  display: grid;
  grid-template-columns: minmax(280px, .95fr) minmax(300px, 1.05fr) minmax(320px, 1.08fr);
  gap: 16px;
  align-items: stretch;
  padding: 18px;
  border-radius: 34px;
  overflow: hidden;
  border: 1px solid rgba(0, 122, 47, .16);
  background:
    radial-gradient(circle at 24% 50%, rgba(0,122,47,.18), transparent 28%),
    radial-gradient(circle at 70% 22%, rgba(181,132,43,.18), transparent 22%),
    linear-gradient(135deg, rgba(5,42,30,.97), rgba(7,70,48,.90) 42%, rgba(248,250,247,.94) 43%, rgba(255,255,255,.92));
  box-shadow: 0 26px 76px rgba(7, 22, 17, .14);
}
.entry-ai-stage::before {
  content: '';
  position: absolute;
  inset: -40% -10%;
  background: repeating-linear-gradient(112deg, rgba(255,255,255,.13) 0 1px, transparent 1px 16px);
  animation: entryAiGrid 9s linear infinite;
  pointer-events: none;
}
.entry-ai-orb {
  position: relative;
  min-height: 100%;
  display: grid;
  place-items: center;
  border-radius: 28px;
  border: 1px solid rgba(255,255,255,.16);
  background: radial-gradient(circle at 50% 50%, rgba(255,255,255,.18), rgba(255,255,255,.05) 36%, rgba(0,0,0,.10));
  overflow: hidden;
}
.entry-ai-ring, .entry-ai-pulse { position: absolute; border-radius: 999px; pointer-events: none; }
.entry-ai-ring { border: 1px solid rgba(205,255,224,.58); box-shadow: 0 0 26px rgba(112,255,168,.28); animation: entryAiSpin 12s linear infinite; }
.entry-ai-ring.ring-a { width: 230px; height: 230px; }
.entry-ai-ring.ring-b { width: 170px; height: 170px; animation-duration: 8.5s; animation-direction: reverse; border-style: dashed; }
.entry-ai-ring.ring-c { width: 285px; height: 112px; transform: rotate(-24deg); animation-duration: 10s; }
.entry-ai-core { position: relative; z-index: 2; display: grid; place-items: center; width: 108px; height: 108px; border-radius: 34px; color: #eafff1; background: linear-gradient(145deg, rgba(0,122,47,.98), rgba(6,65,46,.78)); box-shadow: 0 0 0 10px rgba(255,255,255,.08), 0 0 56px rgba(112,255,168,.54); animation: entryAiBreath 2.8s ease-in-out infinite; }
.entry-ai-pulse { width: 9px; height: 9px; background: #eafff1; box-shadow: 0 0 20px rgba(234,255,241,.9); animation: entryAiPulse 3.4s ease-in-out infinite; }
.entry-ai-pulse.pulse-a { left: 16%; top: 28%; }
.entry-ai-pulse.pulse-b { right: 18%; top: 34%; animation-delay: .7s; }
.entry-ai-pulse.pulse-c { left: 46%; bottom: 18%; animation-delay: 1.2s; }
.entry-ai-copy, .entry-ai-signal, .entry-ai-orb { position: relative; z-index: 1; }
.entry-ai-copy { display: grid; align-content: center; gap: 13px; padding: 28px; border-radius: 28px; background: rgba(255,255,255,.90); border: 1px solid rgba(7,22,17,.08); box-shadow: 0 18px 46px rgba(7,22,17,.09); }
.entry-ai-copy span { width: fit-content; padding: 7px 10px; border-radius: 999px; color: #087a3b; background: rgba(0,122,47,.08); font-size: 11px; font-weight: 950; letter-spacing: .045em; text-transform: uppercase; }
.entry-ai-copy strong { color: #071611; font-size: clamp(28px, 3vw, 48px); line-height: .98; letter-spacing: -.056em; font-weight: 950; }
.entry-ai-copy p { margin: 0; color: #53605a; font-size: 15.5px; line-height: 1.46; font-weight: 670; }
.entry-ai-signal-grid { position: relative; z-index: 1; display: grid; grid-template-columns: 1fr; gap: 10px; align-content: stretch; }
.entry-ai-signal { min-height: 102px; padding: 14px; border-radius: 22px; display: grid; grid-template-columns: auto 1fr; gap: 7px 11px; align-content: start; border: 1px solid rgba(7,22,17,.08); background: rgba(255,255,255,.88); box-shadow: 0 16px 36px rgba(7,22,17,.08); }
.entry-ai-signal span { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 15px; color: #087a3b; background: rgba(0,122,47,.08); }
.entry-ai-signal strong { display: block; color: #071611; font-size: 16px; font-weight: 950; letter-spacing: -.032em; }
.entry-ai-signal small { display: block; margin-top: 3px; color: #617069; font-size: 12.5px; line-height: 1.32; font-weight: 650; }
.entry-ai-signal em { grid-column: 1 / -1; width: fit-content; padding: 5px 9px; border-radius: 999px; color: #087a3b; background: rgba(0,122,47,.07); font-size: 10.5px; font-style: normal; font-weight: 950; text-transform: uppercase; letter-spacing: .035em; }
@keyframes entryAiSpin { from { transform: rotate(0deg) scale(1); } to { transform: rotate(360deg) scale(1); } }
@keyframes entryAiBreath { 0%,100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.06); filter: brightness(1.16); } }
@keyframes entryAiPulse { 0%,100% { transform: translateY(0) scale(.75); opacity: .35; } 50% { transform: translateY(-18px) scale(1.5); opacity: 1; } }
@keyframes entryAiGrid { from { transform: translateX(0); } to { transform: translateX(120px); } }
@media (max-width: 1180px) {
  .entry-ai-stage { grid-template-columns: 1fr; background: linear-gradient(145deg, rgba(5,42,30,.98), rgba(7,70,48,.92) 36%, rgba(248,250,247,.95) 37%, rgba(255,255,255,.94)); }
  .entry-ai-orb { min-height: 300px; }
}
@media (max-width: 980px) {
  .entry-ai-command { padding-top: 10px; }
  .entry-ai-stage { min-height: auto; padding: 12px; border-radius: 26px; }
  .entry-ai-orb { min-height: 260px; border-radius: 22px; }
  .entry-ai-copy { padding: 20px; border-radius: 22px; }
  .entry-ai-copy strong { font-size: clamp(28px, 8vw, 38px); }
  .entry-ai-signal-grid { gap: 9px; }
  .entry-ai-signal { min-height: 104px; padding: 13px; border-radius: 19px; }
}
@media (max-width: 420px) {
  .entry-ai-orb { min-height: 230px; }
  .entry-ai-ring.ring-a { width: 196px; height: 196px; }
  .entry-ai-ring.ring-b { width: 142px; height: 142px; }
  .entry-ai-ring.ring-c { width: 236px; height: 92px; }
  .entry-ai-core { width: 92px; height: 92px; border-radius: 30px; }
}
`;
