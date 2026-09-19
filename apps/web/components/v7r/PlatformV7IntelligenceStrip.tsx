import { getLocale } from 'next-intl/server';

type Lang = 'ru' | 'en' | 'zh';

const copy = {
  ru: {
    kicker: 'После согласования условий',
    title: 'Сделка движется по подтверждённым этапам',
    text: 'Перевозка, приёмка, документы и расчёты ведутся последовательно. Для каждого этапа видны ответственный участник, требуемое действие и зафиксированный результат.',
    flow: ['Условия', 'Перевозка', 'Приёмка', 'Расчёт'],
    items: [
      ['Показывает, что требуется', 'Участник видит действие, которое нужно выполнить сейчас.'],
      ['Назначает ответственность', 'Каждая задача закреплена за ролью с соответствующими правами.'],
      ['Сохраняет историю', 'Статусы, документы и решения остаются в хронологии сделки.'],
    ],
  },
  en: {
    kicker: 'After the terms are agreed',
    title: 'The deal moves through confirmed stages',
    text: 'Transport, acceptance, documents, and settlement follow a defined sequence. Each stage shows the responsible participant, required action, and recorded result.',
    flow: ['Terms', 'Transport', 'Acceptance', 'Settlement'],
    items: [
      ['Shows what is required', 'Each participant sees the action that needs to be completed now.'],
      ['Assigns responsibility', 'Every task is assigned to a role with the relevant permissions.'],
      ['Keeps the history', 'Statuses, documents, and decisions remain in the deal timeline.'],
    ],
  },
  zh: {
    kicker: '交易条件确认后',
    title: '交易按已确认阶段推进',
    text: '运输、验收、文件和结算按顺序进行。每个阶段都会显示责任方、所需操作和已记录结果。',
    flow: ['条件', '运输', '验收', '结算'],
    items: [
      ['明确当前任务', '每个参与方都能看到现在需要完成的操作。'],
      ['明确责任方', '每项任务都分配给具备相应权限的角色。'],
      ['保留完整记录', '状态、文件和决定保留在交易时间线中。'],
    ],
  },
} as const;

const glyphs = ['✓', '→', '₽'] as const;

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
          {t.items.map(([title, text], index) => (
            <article className='entry-intelligence-tile' key={title}>
              <span aria-hidden='true'><b>{glyphs[index]}</b></span>
              <strong>{title}</strong>
              <small>{text}</small>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
