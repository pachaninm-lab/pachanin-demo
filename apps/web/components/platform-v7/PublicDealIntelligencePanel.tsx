import { CheckCircle2, Clock3, FileSearch, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';

export type PublicDealLens = 'execution' | 'documents' | 'money' | 'risk';
type Locale = 'ru' | 'en' | 'zh';

type LensCopy = {
  blocker: string;
  impact: string;
  atRisk: string;
  action: string;
};

const COPY = {
  ru: {
    title: 'TAI · Сводка для покупателя',
    demo: 'Публичный пример',
    attention: 'Требует внимания',
    labels: { impact: 'Влияние', risk: 'Под риском', action: 'Следующее действие', evidence: 'Основания и актуальность' },
    lenses: {
      execution: { blocker: 'Лабораторный протокол не подтверждён.', impact: 'Расчёт по сделке остаётся заблокированным.', atRisk: '6,9 млн ₽ · контрольное окно 6 часов', action: 'Подготовить запрос лаборатории на подтверждение протокола.' },
      documents: { blocker: 'В комплекте отсутствует подтверждённая версия лабораторного протокола.', impact: 'Документальное основание для расчёта не сформировано.', atRisk: '1 обязательный документ · версия требует сверки', action: 'Сопоставить реквизиты акта приёмки и последней версии протокола.' },
      money: { blocker: 'Денежное основание не наступило из-за неполного комплекта.', impact: 'Платёж нельзя безопасно перевести в исполняемое состояние.', atRisk: '6,9 млн ₽ остаются заблокированными', action: 'Подготовить проверяемый перечень недостающих оснований для банка и покупателя.' },
      risk: { blocker: 'Срок подтверждения качества приближается к контрольной границе.', impact: 'Возможны задержка расчёта и переход к регламенту урегулирования.', atRisk: 'Средний риск · 6 часов до эскалации', action: 'Уведомить ответственного и подготовить доказательную хронологию.' },
    } satisfies Record<PublicDealLens, LensCopy>,
    sources: [
      ['Карточка сделки', 'DEAL-DEMO-240721', 'Сценарий · 14:32', 'Подтверждено в публичном примере'],
      ['Акт приёмки', 'ACT-DEMO-V3', 'Сценарий · 14:28', 'Подтверждено в публичном примере'],
      ['Реестр документов', 'DOC-REG-DEMO', 'Сценарий · 14:31', 'Протокол не подтверждён'],
      ['Государственное основание', '—', 'Текущая проверка не выполнялась', 'Не проверено: подключение организации не подтверждено'],
    ],
    safety: 'Ничего не отправлено и не изменено без подтверждения пользователя.',
  },
  en: {
    title: 'TAI · Buyer summary',
    demo: 'Public example',
    attention: 'Needs attention',
    labels: { impact: 'Impact', risk: 'At risk', action: 'Next action', evidence: 'Grounds and freshness' },
    lenses: {
      execution: { blocker: 'The laboratory report is not confirmed.', impact: 'Settlement remains blocked.', atRisk: '₽6.9m · 6-hour control window', action: 'Prepare a request to the laboratory to confirm the report.' },
      documents: { blocker: 'The confirmed laboratory report version is missing.', impact: 'The documentary ground for settlement is incomplete.', atRisk: '1 mandatory document · version must be reconciled', action: 'Compare the acceptance act details with the latest report version.' },
      money: { blocker: 'The payment ground has not occurred because the package is incomplete.', impact: 'Payment cannot safely enter an executable state.', atRisk: '₽6.9m remains blocked', action: 'Prepare a verifiable list of missing grounds for the bank and buyer.' },
      risk: { blocker: 'The quality confirmation deadline is approaching.', impact: 'Settlement delay and escalation may follow.', atRisk: 'Medium risk · 6 hours to escalation', action: 'Notify the owner and prepare the evidence chronology.' },
    } satisfies Record<PublicDealLens, LensCopy>,
    sources: [
      ['Deal card', 'DEAL-DEMO-240721', 'Scenario · 14:32', 'Confirmed in the public example'],
      ['Acceptance act', 'ACT-DEMO-V3', 'Scenario · 14:28', 'Confirmed in the public example'],
      ['Document registry', 'DOC-REG-DEMO', 'Scenario · 14:31', 'Report not confirmed'],
      ['Government ground', '—', 'No current check performed', 'Not checked: organisation connection is not confirmed'],
    ],
    safety: 'Nothing was sent or changed without user confirmation.',
  },
  zh: {
    title: 'TAI · 买方摘要',
    demo: '公开示例',
    attention: '需要处理',
    labels: { impact: '影响', risk: '风险', action: '下一步', evidence: '依据与时效' },
    lenses: {
      execution: { blocker: '实验室报告尚未确认。', impact: '交易结算仍被阻塞。', atRisk: '690 万卢布 · 6 小时控制窗口', action: '准备向实验室发送报告确认请求。' },
      documents: { blocker: '缺少已确认的实验室报告版本。', impact: '结算所需的文件依据不完整。', atRisk: '1 份必需文件 · 版本需要核对', action: '核对验收单与最新报告版本的信息。' },
      money: { blocker: '由于文件不完整，付款依据尚未成立。', impact: '付款不能安全进入执行状态。', atRisk: '690 万卢布仍被锁定', action: '为银行和买方准备可核验的缺失依据清单。' },
      risk: { blocker: '质量确认期限接近控制边界。', impact: '可能导致结算延迟并进入升级流程。', atRisk: '中等风险 · 距升级 6 小时', action: '通知负责人并准备证据时间线。' },
    } satisfies Record<PublicDealLens, LensCopy>,
    sources: [
      ['交易卡', 'DEAL-DEMO-240721', '示例 · 14:32', '在公开示例中已确认'],
      ['验收单', 'ACT-DEMO-V3', '示例 · 14:28', '在公开示例中已确认'],
      ['文件登记', 'DOC-REG-DEMO', '示例 · 14:31', '报告未确认'],
      ['政府依据', '—', '未执行当前检查', '未核验：组织连接尚未确认'],
    ],
    safety: '未经用户确认，未发送或修改任何内容。',
  },
} as const;

export function PublicDealIntelligencePanel({ locale, lens }: { locale: string; lens: PublicDealLens }) {
  const localeKey: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const copy = COPY[localeKey];
  const detail = copy.lenses[lens];

  return (
    <aside className='pc-public-deal-intelligence' aria-live='polite' aria-label={copy.title} data-lens={lens}>
      <header>
        <span aria-hidden='true'><Sparkles size={18} /></span>
        <div><strong>{copy.title}</strong><small>{copy.demo}</small></div>
      </header>
      <section className='pc-public-deal-intelligence-alert'>
        <span><TriangleAlert size={16} aria-hidden='true' />{copy.attention}</span>
        <p>{detail.blocker}</p>
      </section>
      <dl className='pc-public-deal-intelligence-summary'>
        <div><dt><FileSearch size={15} aria-hidden='true' />{copy.labels.impact}</dt><dd>{detail.impact}</dd></div>
        <div><dt><Clock3 size={15} aria-hidden='true' />{copy.labels.risk}</dt><dd>{detail.atRisk}</dd></div>
        <div className='pc-public-deal-intelligence-next'><dt><CheckCircle2 size={15} aria-hidden='true' />{copy.labels.action}</dt><dd>{detail.action}</dd></div>
      </dl>
      <details className='pc-public-deal-intelligence-evidence'>
        <summary>{copy.labels.evidence}</summary>
        <div>
          {copy.sources.map(([name, id, checked, status]) => (
            <article key={`${name}-${id}`}>
              <strong>{name}</strong>
              <span>{id}</span>
              <small>{checked}</small>
              <em>{status}</em>
            </article>
          ))}
        </div>
      </details>
      <p className='pc-public-deal-intelligence-safety'><ShieldCheck size={15} aria-hidden='true' />{copy.safety}</p>
    </aside>
  );
}
