import { AlertCircle, Clock3, Database, ShieldCheck } from 'lucide-react';

export type PublicGovernmentStatus =
  | 'CONNECTED'
  | 'PUBLIC_REGISTRY'
  | 'OFFICIAL_ACCESS_REQUIRED'
  | 'DEGRADED'
  | 'OUTAGE'
  | 'STALE'
  | 'NOT_CONNECTED'
  | 'REVOKED';

export type PublicGovernmentSource = {
  code: string;
  name: string;
  checks: string;
  capability: string;
  impact: string;
  integrationMode: string;
  status: PublicGovernmentStatus;
  statusLabel: string;
  freshness: string;
  limitation: string;
};

type Locale = 'ru' | 'en' | 'zh';

const LABELS = {
  ru: { source: 'Источник', checks: 'Может проверять', result: 'Текущий результат', resultValue: 'Проверка не выполнялась', impact: 'Влияние на сделку', freshness: 'Актуальность', status: 'Статус подключения', mode: 'Режим', limitation: 'Ограничение' },
  en: { source: 'Source', checks: 'Can check', result: 'Current result', resultValue: 'No check performed', impact: 'Deal impact', freshness: 'Freshness', status: 'Connection status', mode: 'Mode', limitation: 'Limitation' },
  zh: { source: '来源', checks: '可检查', result: '当前结果', resultValue: '尚未执行检查', impact: '对交易的影响', freshness: '时效', status: '连接状态', mode: '模式', limitation: '限制' },
} as const;

export function PublicGovernmentSourceResult({ source, locale }: { source: PublicGovernmentSource; locale: string }) {
  const localeKey: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const labels = LABELS[localeKey];

  return (
    <aside className='pc-public-government-result' aria-live='polite' data-status={source.status}>
      <header>
        <span aria-hidden='true'><Database size={18} /></span>
        <div><small>{labels.source}</small><strong>{source.name}</strong></div>
      </header>
      <dl>
        <div><dt>{labels.checks}</dt><dd>{source.checks}</dd></div>
        <div className='pc-public-government-result-unchecked'><dt>{labels.result}</dt><dd><AlertCircle size={15} aria-hidden='true' />{labels.resultValue}</dd></div>
        <div><dt>{labels.impact}</dt><dd>{source.impact}</dd></div>
        <div><dt><Clock3 size={14} aria-hidden='true' />{labels.freshness}</dt><dd>{source.freshness}</dd></div>
        <div><dt><ShieldCheck size={14} aria-hidden='true' />{labels.status}</dt><dd>{source.statusLabel}</dd></div>
        <div><dt>{labels.mode}</dt><dd><code>{source.integrationMode}</code></dd></div>
      </dl>
      <p><strong>{labels.limitation}:</strong> {source.limitation}</p>
    </aside>
  );
}
