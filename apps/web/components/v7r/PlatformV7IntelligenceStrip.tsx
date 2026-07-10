import { ArrowRight, Banknote, ShieldCheck } from 'lucide-react';
import { getLocale } from 'next-intl/server';

type Lang = 'ru' | 'en' | 'zh';

const copy = {
  ru: {
    kicker: 'Контур исполнения после цены',
    title: 'Сделка не заканчивается на согласованной цене',
    text: 'Главный риск начинается дальше: рейс, приёмка, качество, документы, расчёт, спор и доказательства должны быть связаны в один проверяемый процесс.',
    flow: ['Цена', 'Рейс', 'Приёмка', 'Расчёт'],
    items: [
      ['Видит место остановки', 'Показывает, где сделка требует действия: рейс, вес, качество, документ, расчёт или спор.'],
      ['Фиксирует следующий шаг', 'Связывает задачу с ролью участника: продавец, покупатель, логистика, элеватор, лаборатория, банк или арбитр.'],
      ['Собирает основание', 'Факты исполнения, документы и статусы складываются в проверяемую базу для расчёта и разбора расхождений.'],
    ],
  },
  en: {
    kicker: 'Execution circuit after price agreement',
    title: 'The deal does not end at the agreed price',
    text: 'The main risk starts after that: trip, acceptance, quality, documents, settlement, dispute and evidence must stay connected in one verifiable process.',
    flow: ['Price', 'Trip', 'Acceptance', 'Settlement'],
    items: [
      ['Shows the blocker', 'Shows where the deal requires action: trip, weight, quality, document, settlement or dispute.'],
      ['Locks the next step', 'Links the task to the participant role: seller, buyer, logistics, elevator, laboratory, bank or arbitrator.'],
      ['Builds the basis', 'Execution facts, documents and statuses form a verifiable basis for settlement and discrepancy review.'],
    ],
  },
  zh: {
    kicker: '价格确认后的执行闭环',
    title: '交易不会停在已确认的价格上',
    text: '真正的风险在后续环节开始：运输、验收、质量、文件、结算、争议和证据必须连接成一个可核验流程。',
    flow: ['价格', '运输', '验收', '结算'],
    items: [
      ['看清卡点位置', '显示交易在哪个环节需要行动：运输、重量、质量、文件、结算或争议。'],
      ['固定下一步动作', '把任务绑定到对应参与方角色：卖方、买方、物流、粮仓、实验室、银行或仲裁员。'],
      ['汇集结算依据', '执行事实、文件和状态汇集成可核验基础，用于结算和差异复盘。'],
    ],
  },
} as const;

const icons = [ShieldCheck, ArrowRight, Banknote];

export async function PlatformV7IntelligenceStrip() {
  const locale = await getLocale();
  const lang: Lang = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const t = copy[lang];

  return (
    <section id='intelligence' className='entry-section entry-intelligence-section' aria-labelledby='intelligence-title' data-lang={lang}>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className='entry-intelligence-panel'>
        <div className='entry-intelligence-main'>
          <span className='entry-section-kicker'>{t.kicker}</span>
          <h2 id='intelligence-title'>{t.title}</h2>
          <p>{t.text}</p>
        </div>
        <div className='entry-intelligence-flow' aria-label={t.kicker}>{t.flow.map((item) => <span key={item}>{item}</span>)}</div>
        <div className='entry-intelligence-grid'>
          {t.items.map(([title, text], index) => {
            const Icon = icons[index];
            return <article className='entry-intelligence-tile' key={title}><span><Icon size={20} aria-hidden='true' /></span><strong>{title}</strong><small>{text}</small></article>;
          })}
        </div>
      </div>
    </section>
  );
}

const css = `
.entry-intelligence-section{padding-top:8px}.entry-intelligence-panel{display:grid;grid-template-columns:1fr;gap:14px;padding:16px;border-radius:30px;border:1px solid rgba(0,122,47,.12);background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(246,250,245,.94));box-shadow:0 18px 48px rgba(7,22,17,.07)}.entry-intelligence-main{padding:20px;border-radius:23px;background:rgba(255,255,255,.82);border:1px solid rgba(7,22,17,.06)}.entry-intelligence-main h2{margin:0;font-size:clamp(25px,2.4vw,38px);line-height:1.04;letter-spacing:-.047em;font-weight:950}.entry-intelligence-main p{margin:12px 0 0;color:#5c6862;font-size:14.5px;line-height:1.44;font-weight:650}.entry-intelligence-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:14px;border-radius:23px;background:rgba(7,65,46,.05)}.entry-intelligence-flow span{display:grid;place-items:center;min-height:44px;border-radius:16px;background:#fff;color:#153028;font-size:12px;font-weight:950}.entry-intelligence-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.entry-intelligence-tile{min-height:154px;padding:16px;border-radius:22px;display:grid;align-content:start;gap:9px;border:1px solid rgba(7,22,17,.075);background:rgba(255,255,255,.82);box-shadow:0 14px 34px rgba(7,22,17,.06)}.entry-intelligence-tile span{display:grid;place-items:center;width:42px;height:42px;border-radius:15px;color:#087a3b;background:rgba(0,122,47,.08)}.entry-intelligence-tile strong{color:#071611;font-size:16px;font-weight:950;letter-spacing:-.03em}.entry-intelligence-tile small{color:#65716b;font-size:12.5px;line-height:1.34;font-weight:650}.entry-intelligence-section[data-lang='zh']{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Noto Sans SC','Microsoft YaHei','Segoe UI',sans-serif}.entry-intelligence-section[data-lang='zh'] *{letter-spacing:0!important;word-break:keep-all;overflow-wrap:anywhere}.entry-intelligence-section[data-lang='zh'] .entry-intelligence-main h2{line-height:1.15;font-size:clamp(25px,5.6vw,34px)}.entry-intelligence-section[data-lang='zh'] .entry-intelligence-main p{line-height:1.58;font-size:14px}.entry-intelligence-section[data-lang='zh'] .entry-intelligence-tile strong{font-size:17px;line-height:1.18}.entry-intelligence-section[data-lang='zh'] .entry-intelligence-tile small{line-height:1.5}@media(max-width:980px){.entry-intelligence-grid{grid-template-columns:1fr}.entry-intelligence-tile{min-height:120px}}@media(max-width:420px){.entry-intelligence-flow{grid-template-columns:repeat(4,minmax(0,1fr));padding:10px;gap:6px}.entry-intelligence-flow span{font-size:11px;min-height:40px}}
`;
