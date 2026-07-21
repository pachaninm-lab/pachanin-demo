'use client';

import * as React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  FileText,
  SearchCheck,
  ShieldCheck,
  Sparkles,
  Truck,
  UserCheck,
  WalletCards,
} from 'lucide-react';

type Locale = 'ru' | 'en' | 'zh';
type ScenarioKey = 'acceptance' | 'documents' | 'money' | 'risk';

type Scenario = {
  tab: string;
  problemLabel: string;
  problem: string;
  signalLabel: string;
  signal: string;
  reasonLabel: string;
  reason: string;
  evidenceLabel: string;
  evidence: string;
  nextLabel: string;
  next: string;
  source: string;
};

type Copy = {
  eyebrow: string;
  title: string;
  lead: string;
  mode: string;
  modeText: string;
  scenarioEyebrow: string;
  scenarioTitle: string;
  scenarioLead: string;
  flowEyebrow: string;
  flowTitle: string;
  flowLead: string;
  flow: readonly { title: string; text: string }[];
  boundariesEyebrow: string;
  boundariesTitle: string;
  boundariesLead: string;
  boundaries: readonly { title: string; text: string }[];
  home: string;
  login: string;
  scenarios: Record<ScenarioKey, Scenario>;
};

const COPY: Record<Locale, Copy> = {
  ru: {
    eyebrow: 'Transparent Agro Intelligence',
    title: 'ИИ видит риск до того, как он станет спором',
    lead: 'Он связывает событие, документ, ограничение и следующий разрешённый шаг. Ответ сопровождается причиной и доказательствами, а критическое действие остаётся за человеком.',
    mode: 'Публичный обезличенный сценарий',
    modeText: 'Здесь нет доступа к личным кабинетам, организациям, реальным сделкам и платежам.',
    scenarioEyebrow: 'Один процесс — четыре точки контроля',
    scenarioTitle: 'Посмотрите, как ИИ разбирает ситуацию',
    scenarioLead: 'Выберите сценарий. Меняется проблема, доказательная база и подготовленный следующий шаг.',
    flowEyebrow: 'Причинная цепочка',
    flowTitle: 'От сигнала к проверяемому решению',
    flowLead: 'ИИ не выдаёт изолированный совет. Он строит трассу от факта до действия и сохраняет границу полномочий.',
    flow: [
      { title: 'Событие', text: 'Получает разрешённые данные конкретного этапа сделки.' },
      { title: 'Проверка', text: 'Сопоставляет статусы, документы, сроки и ограничения.' },
      { title: 'Объяснение', text: 'Показывает, что произошло и почему это важно.' },
      { title: 'Следующий шаг', text: 'Готовит действие, доступное текущей роли.' },
      { title: 'Подтверждение', text: 'Критическое действие выполняет уполномоченный участник.' },
    ],
    boundariesEyebrow: 'Контролируемый ИИ',
    boundariesTitle: 'Что помощник принципиально не делает',
    boundariesLead: 'Ценность создаётся не автономностью любой ценой, а точностью, прозрачностью и соблюдением полномочий.',
    boundaries: [
      { title: 'Не расширяет права', text: 'Роль, организация и доступ к данным определяются сервером, а не запросом пользователя.' },
      { title: 'Не выполняет критические действия сам', text: 'Выплата, подпись, решение по спору и другие последствия требуют отдельного подтверждения.' },
      { title: 'Не выдумывает основание', text: 'Если фактов недостаточно, помощник сообщает об этом и запрашивает недостающий источник.' },
    ],
    home: 'Вернуться на главную',
    login: 'Войти в платформу',
    scenarios: {
      acceptance: {
        tab: 'Приёмка',
        problemLabel: 'Обнаружено',
        problem: 'Фактический вес отличается от данных рейса',
        signalLabel: 'Сигнал',
        signal: '−1,8 т к заявленному весу',
        reasonLabel: 'Причина внимания',
        reason: 'Расхождение влияет на акт приёмки и основание расчёта.',
        evidenceLabel: 'Проверено',
        evidence: 'Рейс, весовая запись, партия, время фиксации',
        nextLabel: 'Подготовленный шаг',
        next: 'Проверить весовую запись и подготовить подтверждение фактического веса.',
        source: 'Источник: данные рейса и запись приёмки. Действие требует подтверждения сотрудника элеватора.',
      },
      documents: {
        tab: 'Документы',
        problemLabel: 'Обнаружено',
        problem: 'Комплект документов не подтверждает текущий этап',
        signalLabel: 'Сигнал',
        signal: 'Отсутствует обязательное основание',
        reasonLabel: 'Причина внимания',
        reason: 'Без документа нельзя безопасно перейти к денежному событию.',
        evidenceLabel: 'Проверено',
        evidence: 'Реестр документов, статус подписи, версия комплекта',
        nextLabel: 'Подготовленный шаг',
        next: 'Сформировать запрос ответственному участнику на недостающий документ.',
        source: 'Источник: реестр документов сделки. ИИ только готовит запрос и не подписывает документ.',
      },
      money: {
        tab: 'Деньги',
        problemLabel: 'Обнаружено',
        problem: 'Основание выплаты ещё не подтверждено событиями сделки',
        signalLabel: 'Сигнал',
        signal: 'Расчёт заблокирован',
        reasonLabel: 'Причина внимания',
        reason: 'Приёмка и комплект документов ещё не образуют подтверждённое основание.',
        evidenceLabel: 'Проверено',
        evidence: 'Приёмка, качество, документы, денежное событие',
        nextLabel: 'Подготовленный шаг',
        next: 'Показать недостающие условия и владельца каждого действия.',
        source: 'Источник: статусы исполнения сделки. ИИ не инициирует и не подтверждает выплату.',
      },
      risk: {
        tab: 'Риск',
        problemLabel: 'Обнаружено',
        problem: 'Срок контрольного действия истекает раньше завершения этапа',
        signalLabel: 'Сигнал',
        signal: 'Высокий риск просрочки',
        reasonLabel: 'Причина внимания',
        reason: 'Просрочка увеличивает вероятность разрыва доказательной цепочки.',
        evidenceLabel: 'Проверено',
        evidence: 'Срок, ответственный, блокер, история событий',
        nextLabel: 'Подготовленный шаг',
        next: 'Предупредить ответственного и подготовить эскалацию оператору.',
        source: 'Источник: сроки и журнал событий. Эскалацию подтверждает уполномоченный участник.',
      },
    },
  },
  en: {
    eyebrow: 'Transparent Agro Intelligence',
    title: 'AI detects risk before it becomes a dispute',
    lead: 'It links an event, document, restriction and the next permitted step. Every answer includes a reason and evidence, while consequential action remains with a person.',
    mode: 'Public anonymised scenario',
    modeText: 'This page has no access to workspaces, organisations, real deals or payments.',
    scenarioEyebrow: 'One process — four control points',
    scenarioTitle: 'See how AI analyses a situation',
    scenarioLead: 'Choose a scenario. The problem, evidence and prepared next step change together.',
    flowEyebrow: 'Causal chain',
    flowTitle: 'From signal to a verifiable decision',
    flowLead: 'AI does not provide an isolated recommendation. It builds a trace from fact to action and preserves authority boundaries.',
    flow: [
      { title: 'Event', text: 'Receives permitted data for the relevant deal stage.' },
      { title: 'Check', text: 'Compares statuses, documents, deadlines and restrictions.' },
      { title: 'Explanation', text: 'Shows what happened and why it matters.' },
      { title: 'Next step', text: 'Prepares an action available to the current role.' },
      { title: 'Confirmation', text: 'An authorised participant performs consequential action.' },
    ],
    boundariesEyebrow: 'Governed AI',
    boundariesTitle: 'What the assistant never does',
    boundariesLead: 'Value comes from accuracy, traceability and authority control rather than autonomy at any cost.',
    boundaries: [
      { title: 'Does not expand access', text: 'Role, organisation and data access are resolved by the server, not by the user prompt.' },
      { title: 'Does not execute critical actions alone', text: 'Payments, signatures and dispute decisions require separate confirmation.' },
      { title: 'Does not invent evidence', text: 'When facts are insufficient, the assistant states the limitation and requests the missing source.' },
    ],
    home: 'Return home',
    login: 'Sign in',
    scenarios: {
      acceptance: { tab: 'Acceptance', problemLabel: 'Detected', problem: 'Actual weight differs from the trip record', signalLabel: 'Signal', signal: '−1.8 t versus declared weight', reasonLabel: 'Why it matters', reason: 'The discrepancy affects the acceptance act and settlement basis.', evidenceLabel: 'Checked', evidence: 'Trip, weighing record, batch and timestamp', nextLabel: 'Prepared step', next: 'Review the weighing record and prepare confirmation of actual weight.', source: 'Source: trip data and acceptance record. Confirmation remains with authorised elevator staff.' },
      documents: { tab: 'Documents', problemLabel: 'Detected', problem: 'The document set does not support the current stage', signalLabel: 'Signal', signal: 'Required basis is missing', reasonLabel: 'Why it matters', reason: 'The process cannot safely move to a monetary event.', evidenceLabel: 'Checked', evidence: 'Document registry, signature status and version', nextLabel: 'Prepared step', next: 'Prepare a request to the responsible participant for the missing document.', source: 'Source: deal document registry. AI prepares the request and does not sign documents.' },
      money: { tab: 'Money', problemLabel: 'Detected', problem: 'The payment basis is not yet supported by deal events', signalLabel: 'Signal', signal: 'Settlement is blocked', reasonLabel: 'Why it matters', reason: 'Acceptance and documents do not yet form a confirmed basis.', evidenceLabel: 'Checked', evidence: 'Acceptance, quality, documents and monetary event', nextLabel: 'Prepared step', next: 'Show missing conditions and the owner of each action.', source: 'Source: deal execution statuses. AI cannot initiate or approve payment.' },
      risk: { tab: 'Risk', problemLabel: 'Detected', problem: 'A control deadline expires before the stage can finish', signalLabel: 'Signal', signal: 'High delay risk', reasonLabel: 'Why it matters', reason: 'Delay can break the evidence chain.', evidenceLabel: 'Checked', evidence: 'Deadline, owner, blocker and event history', nextLabel: 'Prepared step', next: 'Alert the responsible participant and prepare operator escalation.', source: 'Source: deadlines and event log. An authorised participant confirms escalation.' },
    },
  },
  zh: {
    eyebrow: 'Transparent Agro Intelligence',
    title: 'AI 在风险演变为争议之前识别问题',
    lead: '它把事件、文件、限制和下一项允许操作连接起来。每个结论都包含原因和证据，重要操作仍由人员确认。',
    mode: '公开匿名场景',
    modeText: '本页面不访问工作区、组织、真实交易或付款。',
    scenarioEyebrow: '一个流程，四个控制点',
    scenarioTitle: '查看 AI 如何分析情况',
    scenarioLead: '选择场景，问题、证据和建议的下一步会同步变化。',
    flowEyebrow: '因果链',
    flowTitle: '从信号到可验证的决定',
    flowLead: 'AI 不提供孤立建议，而是建立从事实到操作的追踪链并保持权限边界。',
    flow: [
      { title: '事件', text: '读取当前交易阶段允许访问的数据。' },
      { title: '检查', text: '比对状态、文件、期限和限制。' },
      { title: '解释', text: '说明发生了什么以及为何重要。' },
      { title: '下一步', text: '准备当前角色可执行的操作。' },
      { title: '确认', text: '由获授权参与方执行重要操作。' },
    ],
    boundariesEyebrow: '受控 AI',
    boundariesTitle: '助手不会做什么',
    boundariesLead: '价值来自准确性、可追踪性和权限控制，而不是不受限制的自主性。',
    boundaries: [
      { title: '不扩大权限', text: '角色、组织和数据访问由服务器确定，而不是由用户请求决定。' },
      { title: '不独立执行关键操作', text: '付款、签署和争议决定需要单独确认。' },
      { title: '不编造依据', text: '事实不足时，助手会说明限制并请求缺失来源。' },
    ],
    home: '返回首页',
    login: '登录平台',
    scenarios: {
      acceptance: { tab: '验收', problemLabel: '发现', problem: '实际重量与运输记录不一致', signalLabel: '信号', signal: '比申报重量少 1.8 吨', reasonLabel: '重要原因', reason: '差异会影响验收文件和结算依据。', evidenceLabel: '已检查', evidence: '运输、称重记录、批次和时间', nextLabel: '准备的下一步', next: '检查称重记录并准备实际重量确认。', source: '来源：运输数据和验收记录。确认由获授权的粮库人员完成。' },
      documents: { tab: '文件', problemLabel: '发现', problem: '文件集合无法支持当前阶段', signalLabel: '信号', signal: '缺少必要依据', reasonLabel: '重要原因', reason: '在文件补齐前不能安全进入资金事件。', evidenceLabel: '已检查', evidence: '文件登记、签署状态和版本', nextLabel: '准备的下一步', next: '向责任参与方准备缺失文件请求。', source: '来源：交易文件登记。AI 不签署文件。' },
      money: { tab: '资金', problemLabel: '发现', problem: '付款依据尚未得到交易事件支持', signalLabel: '信号', signal: '结算被阻止', reasonLabel: '重要原因', reason: '验收和文件尚未形成已确认依据。', evidenceLabel: '已检查', evidence: '验收、质量、文件和资金事件', nextLabel: '准备的下一步', next: '显示缺失条件以及每项操作的负责人。', source: '来源：交易履约状态。AI 不能发起或批准付款。' },
      risk: { tab: '风险', problemLabel: '发现', problem: '控制期限早于阶段完成时间', signalLabel: '信号', signal: '高延误风险', reasonLabel: '重要原因', reason: '延误可能破坏证据链。', evidenceLabel: '已检查', evidence: '期限、负责人、阻塞项和事件历史', nextLabel: '准备的下一步', next: '提醒负责人并准备向运营人员升级。', source: '来源：期限和事件日志。升级由获授权参与方确认。' },
    },
  },
};

const SCENARIO_KEYS: readonly ScenarioKey[] = ['acceptance', 'documents', 'money', 'risk'];

function ScenarioIcon({ value }: { value: ScenarioKey }) {
  if (value === 'acceptance') return <Truck size={18} aria-hidden='true' />;
  if (value === 'documents') return <FileText size={18} aria-hidden='true' />;
  if (value === 'money') return <WalletCards size={18} aria-hidden='true' />;
  return <AlertTriangle size={18} aria-hidden='true' />;
}

export function SingleServerAiInActionExperience({ locale }: { locale: string }) {
  const localeKey: Locale = locale === 'en' || locale === 'zh' ? locale : 'ru';
  const ui = COPY[localeKey];
  const [active, setActive] = React.useState<ScenarioKey>('acceptance');
  const scenario = ui.scenarios[active];

  return (
    <div className='pc-ss-ai-page' data-single-server-ai-route='true'>
      <section className='pc-ss-ai-hero' aria-labelledby='pc-ss-ai-title'>
        <div className='pc-ss-ai-shell'>
          <span className='pc-ss-ai-eyebrow'><Sparkles size={16} aria-hidden='true' />{ui.eyebrow}</span>
          <h1 id='pc-ss-ai-title'>{ui.title}</h1>
          <p>{ui.lead}</p>
          <div className='pc-ss-ai-mode' role='note'>
            <ShieldCheck size={20} aria-hidden='true' />
            <span><strong>{ui.mode}</strong><small>{ui.modeText}</small></span>
          </div>
        </div>
      </section>

      <section id='scenario' className='pc-ss-ai-section'>
        <div className='pc-ss-ai-shell'>
          <header className='pc-ss-ai-section-head'>
            <span>{ui.scenarioEyebrow}</span>
            <h2>{ui.scenarioTitle}</h2>
            <p>{ui.scenarioLead}</p>
          </header>

          <div className='pc-ss-ai-tabs' role='tablist' aria-label={ui.scenarioTitle}>
            {SCENARIO_KEYS.map((key) => (
              <button
                key={key}
                type='button'
                role='tab'
                aria-selected={active === key}
                onClick={() => setActive(key)}
              >
                <ScenarioIcon value={key} />
                <span>{ui.scenarios[key].tab}</span>
              </button>
            ))}
          </div>

          <div className='pc-ss-ai-result' role='tabpanel' aria-live='polite'>
            <div className='pc-ss-ai-problem'>
              <span>{scenario.problemLabel}</span>
              <h3>{scenario.problem}</h3>
            </div>
            <div className='pc-ss-ai-facts'>
              <article><AlertTriangle size={20} aria-hidden='true' /><span>{scenario.signalLabel}</span><strong>{scenario.signal}</strong></article>
              <article><SearchCheck size={20} aria-hidden='true' /><span>{scenario.reasonLabel}</span><strong>{scenario.reason}</strong></article>
              <article><Database size={20} aria-hidden='true' /><span>{scenario.evidenceLabel}</span><strong>{scenario.evidence}</strong></article>
            </div>
            <div className='pc-ss-ai-next'>
              <CheckCircle2 size={23} aria-hidden='true' />
              <span><small>{scenario.nextLabel}</small><strong>{scenario.next}</strong></span>
            </div>
            <p className='pc-ss-ai-source'>{scenario.source}</p>
          </div>
        </div>
      </section>

      <section id='flow' className='pc-ss-ai-section pc-ss-ai-flow-section'>
        <div className='pc-ss-ai-shell'>
          <header className='pc-ss-ai-section-head'>
            <span>{ui.flowEyebrow}</span>
            <h2>{ui.flowTitle}</h2>
            <p>{ui.flowLead}</p>
          </header>
          <ol className='pc-ss-ai-flow'>
            {ui.flow.map((step, index) => (
              <li key={step.title}>
                <b>{index + 1}</b>
                <span><strong>{step.title}</strong><small>{step.text}</small></span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id='boundaries' className='pc-ss-ai-section'>
        <div className='pc-ss-ai-shell'>
          <header className='pc-ss-ai-section-head'>
            <span>{ui.boundariesEyebrow}</span>
            <h2>{ui.boundariesTitle}</h2>
            <p>{ui.boundariesLead}</p>
          </header>
          <div className='pc-ss-ai-boundaries'>
            {ui.boundaries.map((item, index) => (
              <article key={item.title}>
                {index === 0 ? <ShieldCheck size={22} aria-hidden='true' /> : index === 1 ? <UserCheck size={22} aria-hidden='true' /> : <Database size={22} aria-hidden='true' />}
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
          <div className='pc-ss-ai-actions'>
            <a href={`/platform-v7?lang=${localeKey}`}>{ui.home}<ArrowRight size={18} aria-hidden='true' /></a>
            <a href='/platform-v7/login'>{ui.login}</a>
          </div>
        </div>
      </section>

      <style>{css}</style>
    </div>
  );
}

const css = `
.pc-ss-ai-page{--ai-ink:#07291c;--ai-muted:#52675e;--ai-green:#087a3b;--ai-dark:#053423;--ai-line:#c9ddd1;--ai-soft:#f3f8f5;background:#fff;color:var(--ai-ink);padding-bottom:120px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.pc-ss-ai-page *{box-sizing:border-box;min-width:0}.pc-ss-ai-shell{width:min(1080px,calc(100% - 40px));margin:0 auto}.pc-ss-ai-hero{padding:clamp(70px,8vw,112px) 0 clamp(48px,7vw,84px);background:radial-gradient(circle at 82% 15%,rgba(35,201,105,.22),transparent 30%),linear-gradient(145deg,#03291d,#074b33);color:#fff}.pc-ss-ai-eyebrow{display:inline-flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid rgba(176,232,198,.34);border-radius:999px;background:rgba(255,255,255,.07);font-size:13px;font-weight:820}.pc-ss-ai-hero h1{max-width:880px;margin:20px 0 16px;font-size:clamp(44px,7vw,76px);line-height:.98;letter-spacing:-.055em;text-wrap:balance}.pc-ss-ai-hero>div>p{max-width:780px;margin:0;color:#d8e9e1;font-size:clamp(18px,2.2vw,24px);line-height:1.48}.pc-ss-ai-mode{max-width:760px;display:grid;grid-template-columns:24px minmax(0,1fr);align-items:start;gap:11px;margin-top:28px;padding:15px 16px;border:1px solid rgba(183,225,200,.26);border-radius:16px;background:rgba(255,255,255,.07)}.pc-ss-ai-mode span{display:grid;gap:4px}.pc-ss-ai-mode strong{font-size:15px}.pc-ss-ai-mode small{color:#cfe2d9;font-size:13px;line-height:1.45}
.pc-ss-ai-section{padding:clamp(58px,7vw,88px) 0}.pc-ss-ai-flow-section{background:var(--ai-soft)}.pc-ss-ai-section-head{max-width:800px;margin-bottom:28px}.pc-ss-ai-section-head>span{display:inline-block;color:#08713d;font-size:12px;font-weight:850;text-transform:uppercase;letter-spacing:.07em}.pc-ss-ai-section-head h2{margin:12px 0 10px;font-size:clamp(34px,5vw,54px);line-height:1.04;letter-spacing:-.045em;text-wrap:balance}.pc-ss-ai-section-head p{margin:0;color:var(--ai-muted);font-size:17px;line-height:1.55}
.pc-ss-ai-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:14px}.pc-ss-ai-tabs button{min-height:52px;display:flex;align-items:center;justify-content:center;gap:8px;padding:10px;border:1px solid var(--ai-line);border-radius:13px;background:#fff;color:#315044;font:inherit;font-size:14px;font-weight:780;cursor:pointer}.pc-ss-ai-tabs button[aria-selected='true']{border-color:#17804b;background:#eaf6ee;color:#07572e;box-shadow:inset 0 0 0 1px rgba(8,122,59,.12)}.pc-ss-ai-tabs button:focus-visible,.pc-ss-ai-actions a:focus-visible{outline:3px solid #17649b;outline-offset:3px}
.pc-ss-ai-result{padding:20px;border-radius:24px;background:linear-gradient(155deg,#062d20,#0c4a34);color:#fff;box-shadow:0 22px 54px rgba(5,43,29,.16)}.pc-ss-ai-problem{padding:20px;border:1px solid rgba(255,255,255,.13);border-radius:18px;background:rgba(255,255,255,.055)}.pc-ss-ai-problem span,.pc-ss-ai-facts span,.pc-ss-ai-next small{display:block;color:#a9dfbf;font-size:11px;font-weight:850;text-transform:uppercase;letter-spacing:.075em}.pc-ss-ai-problem h3{max-width:800px;margin:8px 0 0;font-size:clamp(27px,4vw,43px);line-height:1.08;letter-spacing:-.035em}.pc-ss-ai-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}.pc-ss-ai-facts article{min-height:148px;padding:17px;border:1px solid rgba(255,255,255,.12);border-radius:17px;background:rgba(255,255,255,.045)}.pc-ss-ai-facts svg{color:#9bdbb5}.pc-ss-ai-facts span{margin-top:14px}.pc-ss-ai-facts strong{display:block;margin-top:7px;font-size:16px;line-height:1.4}.pc-ss-ai-next{display:grid;grid-template-columns:28px minmax(0,1fr);gap:12px;margin-top:10px;padding:18px;border:1px solid rgba(48,218,125,.68);border-radius:18px;background:rgba(20,151,80,.25)}.pc-ss-ai-next span{display:grid;gap:6px}.pc-ss-ai-next strong{font-size:19px;line-height:1.38}.pc-ss-ai-source{margin:12px 2px 0;color:#c9ddd3;font-size:12px;line-height:1.5}
.pc-ss-ai-flow{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0;padding:0;list-style:none}.pc-ss-ai-flow li{position:relative;min-height:182px;padding:18px;border:1px solid var(--ai-line);border-radius:18px;background:#fff}.pc-ss-ai-flow b{display:grid;place-items:center;width:38px;height:38px;border-radius:12px;background:#e7f4eb;color:#08713d;font-size:16px}.pc-ss-ai-flow span{display:grid;gap:7px;margin-top:18px}.pc-ss-ai-flow strong{font-size:17px}.pc-ss-ai-flow small{color:var(--ai-muted);font-size:14px;line-height:1.48}.pc-ss-ai-boundaries{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.pc-ss-ai-boundaries article{padding:22px;border:1px solid var(--ai-line);border-radius:20px;background:#fff}.pc-ss-ai-boundaries svg{color:var(--ai-green)}.pc-ss-ai-boundaries h3{margin:18px 0 8px;font-size:20px;line-height:1.2}.pc-ss-ai-boundaries p{margin:0;color:var(--ai-muted);font-size:15px;line-height:1.55}.pc-ss-ai-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:28px}.pc-ss-ai-actions a{min-height:50px;display:inline-flex;align-items:center;justify-content:center;gap:10px;padding:12px 18px;border:1px solid var(--ai-green);border-radius:13px;background:var(--ai-green);color:#fff;text-decoration:none;font-size:14px;font-weight:820}.pc-ss-ai-actions a+ a{background:#fff;color:#07572e;border-color:var(--ai-line)}
@media(max-width:760px){.pc-ss-ai-shell{width:min(100% - 28px,1080px)}.pc-ss-ai-hero{padding:36px 0 30px}.pc-ss-ai-hero h1{margin:15px 0 13px;font-size:clamp(37px,10.6vw,48px);line-height:1}.pc-ss-ai-hero>div>p{font-size:16px;line-height:1.48}.pc-ss-ai-mode{margin-top:20px;padding:13px}.pc-ss-ai-section{padding:42px 0}.pc-ss-ai-section-head{margin-bottom:20px}.pc-ss-ai-section-head h2{font-size:32px;line-height:1.08}.pc-ss-ai-section-head p{font-size:15px}.pc-ss-ai-tabs{display:flex;overflow-x:auto;scroll-snap-type:x proximity;padding:2px 1px 8px}.pc-ss-ai-tabs button{flex:0 0 auto;min-width:130px;scroll-snap-align:start}.pc-ss-ai-result{padding:12px;border-radius:20px}.pc-ss-ai-problem{padding:15px}.pc-ss-ai-problem h3{font-size:28px}.pc-ss-ai-facts{grid-template-columns:1fr}.pc-ss-ai-facts article{min-height:0;padding:14px}.pc-ss-ai-facts span{margin-top:9px}.pc-ss-ai-next{padding:15px}.pc-ss-ai-next strong{font-size:17px}.pc-ss-ai-flow{grid-template-columns:1fr;gap:8px}.pc-ss-ai-flow li{min-height:0;display:grid;grid-template-columns:40px minmax(0,1fr);gap:12px;padding:15px}.pc-ss-ai-flow span{margin-top:0}.pc-ss-ai-boundaries{grid-template-columns:1fr;gap:9px}.pc-ss-ai-boundaries article{padding:18px}.pc-ss-ai-boundaries h3{margin-top:13px}.pc-ss-ai-actions{display:grid;grid-template-columns:1fr}.pc-ss-ai-actions a{width:100%}}
@media(prefers-reduced-motion:reduce){.pc-ss-ai-page *{scroll-behavior:auto!important}}
`;
