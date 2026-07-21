'use client';

import * as React from 'react';
import { ArrowRight, CheckCircle2, FileSearch, Sparkles } from 'lucide-react';
import { trackEvent } from '@/lib/analytics/track';

type Locale = 'ru' | 'en' | 'zh';

type Step = {
  label: string;
  value: string;
};

const COPY = {
  ru: {
    platform: 'Как платформа фиксирует',
    tai: 'Как TAI формирует вывод',
    lead: 'TAI не придумывает состояние сделки. Он формирует вывод из зафиксированных событий, документов, полномочий, государственных оснований и ограничений.',
    conclusion: 'Вывод',
    conclusionValue: 'Расчёт пока невозможен',
    reason: 'Причина',
    reasonValue: 'Нет подтверждённого лабораторного протокола',
    sources: 'Источники',
    sourcesValue: ['Акт приёмки', 'Реестр документов', 'Государственное основание — не проверено'],
    recommendation: 'Следующее действие',
    recommendationValue: 'Подготовить запрос на подтверждение протокола',
    sourceNote: 'Публичный пример. Реальные внешние статусы не запрашиваются.',
  },
  en: {
    platform: 'How the platform records facts',
    tai: 'How TAI forms a conclusion',
    lead: 'TAI does not invent deal state. It forms conclusions from recorded events, documents, authority, government grounds, and restrictions.',
    conclusion: 'Conclusion',
    conclusionValue: 'Settlement is not yet possible',
    reason: 'Reason',
    reasonValue: 'No confirmed laboratory report',
    sources: 'Sources',
    sourcesValue: ['Acceptance act', 'Document registry', 'Government ground — not checked'],
    recommendation: 'Next action',
    recommendationValue: 'Prepare a request to confirm the report',
    sourceNote: 'Public example. No live external status is requested.',
  },
  zh: {
    platform: '平台如何记录事实',
    tai: 'TAI 如何形成结论',
    lead: 'TAI 不会编造交易状态。它基于已记录的事件、文件、权限、政府依据和限制形成结论。',
    conclusion: '结论',
    conclusionValue: '目前无法结算',
    reason: '原因',
    reasonValue: '缺少已确认的实验室报告',
    sources: '来源',
    sourcesValue: ['验收单', '文件登记', '政府依据 — 未核验'],
    recommendation: '下一步',
    recommendationValue: '准备报告确认请求',
    sourceNote: '公开示例。不请求实时外部状态。',
  },
} as const;

export function PublicEvidenceIntelligencePanel({
  locale,
  steps,
  resultLabel,
  resultValue,
}: {
  locale: string;
  steps: readonly Step[];
  resultLabel: string;
  resultValue: string;
}) {
  const localeKey: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const copy = COPY[localeKey];
  const ref = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setVisible(true);
      observer.disconnect();
    }, { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className='pc-public-evidence-intelligence' data-visible={visible ? 'true' : 'false'}>
      <section className='pc-public-evidence-platform' aria-labelledby='pc-public-evidence-platform-title'>
        <span className='pc-public-evidence-column-label' id='pc-public-evidence-platform-title'>{copy.platform}</span>
        <ol className='pc-ppe-evidence-chain'>
          {steps.map((step, index) => (
            <li key={step.label} style={{ '--pc-evidence-delay': `${index * 100}ms` } as React.CSSProperties}>
              <span aria-hidden='true'>{index + 1}</span>
              <div><strong>{step.label}</strong><p>{step.value}</p></div>
            </li>
          ))}
        </ol>
        <div className='pc-ppe-evidence-result'>
          <strong>{resultLabel}</strong>
          <p>{resultValue}</p>
        </div>
      </section>

      <span className='pc-public-evidence-bridge' aria-hidden='true'><ArrowRight size={22} /></span>

      <aside className='pc-public-evidence-tai' aria-labelledby='pc-public-evidence-tai-title'>
        <header><Sparkles size={18} aria-hidden='true' /><strong id='pc-public-evidence-tai-title'>{copy.tai}</strong></header>
        <p className='pc-public-evidence-lead'>{copy.lead}</p>
        <dl>
          <div><dt>{copy.conclusion}</dt><dd>{copy.conclusionValue}</dd></div>
          <div><dt>{copy.reason}</dt><dd>{copy.reasonValue}</dd></div>
          <div><dt>{copy.sources}</dt><dd><ul>{copy.sourcesValue.map((source) => <li key={source}><FileSearch size={14} aria-hidden='true' />{source}</li>)}</ul></dd></div>
          <div className='pc-public-evidence-recommendation'><dt>{copy.recommendation}</dt><dd><CheckCircle2 size={15} aria-hidden='true' />{copy.recommendationValue}</dd></div>
        </dl>
        <button
          type='button'
          className='pc-public-evidence-source-note'
          onClick={() => trackEvent('deal_intelligence_evidence_opened', { source: 'home_evidence', locale: localeKey, dataMode: 'public_example' })}
        >
          {copy.sourceNote}
        </button>
      </aside>
    </div>
  );
}
