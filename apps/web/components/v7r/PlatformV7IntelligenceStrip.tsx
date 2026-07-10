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
