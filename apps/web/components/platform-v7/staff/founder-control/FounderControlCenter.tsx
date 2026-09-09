'use client';

import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { StatusChip } from '@pc/design-system-v8';
import type { AppLocale } from '@/i18n/locale';
import type {
  FounderControlAlert,
  FounderControlBundle,
  FounderControlGate,
  FounderControlHealth,
  FounderControlRecord,
  FounderControlRecordType,
} from '@/lib/platform-v7/founder-control-types';
import styles from './FounderControlCenter.module.css';

type Tab = 'today' | 'money' | 'sales' | 'clients' | 'forecast' | 'evidence' | 'governance' | 'excel';

type Props = Readonly<{
  locale: AppLocale;
  csrfToken: string;
  initialBundle: FounderControlBundle;
}>;

const COPY = {
  ru: {
    eyebrow: 'Личный контур владельца',
    title: 'Управление компанией',
    description: 'Один экран вместо Excel: что с деньгами, продажами, клиентами и что делать сегодня. Расчёты и gates — на сервере; Excel v11.2 остаётся контрольным эталоном.',
    tabs: ['Сегодня','Деньги','Продажи','Клиенты','Прогноз','Доказательства','Управление','Excel 1:1'],
    unavailable: 'Серверный Founder Control ещё не доступен на этом окружении. Никакие демонстрационные цифры не подставляются.',
    refresh: 'Обновить', save: 'Сохранить', add: 'Добавить', cancel: 'Сбросить', current: 'Сейчас', rule: 'Правило', next: 'Что делать',
    noData: 'Пока нет данных.', p0: 'Сначала исправить', p1: 'После P0', source: 'Источник', updated: 'Обновлено',
  },
  en: {
    eyebrow: 'Private owner control plane', title: 'Company control',
    description: 'One screen instead of a spreadsheet: cash, sales, clients and today’s actions. Calculations and gates are server-authoritative; Excel v11.2 remains the audit reference.',
    tabs: ['Today','Cash','Sales','Clients','Forecast','Evidence','Governance','Excel 1:1'],
    unavailable: 'Founder Control is not available in this environment yet. No demo numbers are substituted.',
    refresh: 'Refresh', save: 'Save', add: 'Add', cancel: 'Reset', current: 'Current', rule: 'Rule', next: 'Next action',
    noData: 'No data yet.', p0: 'Fix first', p1: 'After P0', source: 'Source', updated: 'Updated',
  },
  zh: {
    eyebrow: '所有者私有控制中心', title: '公司管理',
    description: '用一个页面替代电子表格：现金、销售、客户和今天的行动。计算和门禁由服务器权威执行；Excel v11.2 保留为审计基准。',
    tabs: ['今天','资金','销售','客户','预测','证据','治理','Excel 1:1'],
    unavailable: '此环境中的 Founder Control 尚不可用。不会用演示数据替代。',
    refresh: '刷新', save: '保存', add: '添加', cancel: '重置', current: '当前', rule: '规则', next: '下一步',
    noData: '暂无数据。', p0: '优先处理', p1: 'P0 之后', source: '来源', updated: '更新于',
  },
} as const;

const TAB_KEYS: Tab[] = ['today','money','sales','clients','forecast','evidence','governance','excel'];

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}
function str(value: unknown) { return typeof value === 'string' ? value : ''; }
function yes(value: unknown) { return value === true || value === 'YES' || value === 'PASS'; }
function rub(value: unknown, locale: AppLocale) {
  const n = num(value); if (n === null) return '—';
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', { maximumFractionDigits: 0 }).format(n) + ' ₽';
}
function metric(value: unknown, locale: AppLocale) {
  const n = num(value); if (n === null) return value == null || value === '' ? '—' : String(value);
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', { maximumFractionDigits: 1 }).format(n);
}
function percent(value: unknown, locale: AppLocale) {
  const n = num(value); if (n === null) return '—';
  return new Intl.NumberFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', { style: 'percent', maximumFractionDigits: 1 }).format(n);
}
function dateTime(value: string | null | undefined, locale: AppLocale) {
  if (!value) return '—'; const d = new Date(value); if (!Number.isFinite(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'zh' ? 'zh-CN' : locale === 'en' ? 'en-GB' : 'ru-RU', { dateStyle:'short', timeStyle:'short' }).format(d);
}
function tone(value: FounderControlGate | FounderControlHealth | 'ALERT' | 'EVIDENCE') {
  if (value === 'GREEN' || value === 'PASS' || value === 'UNLOCKED' || value === 'READY') return 'success' as const;
  if (value === 'RED' || value === 'BLOCK' || value === 'ALERT') return 'critical' as const;
  if (value === 'YELLOW' || value === 'EVIDENCE' || value === 'WATCH' || value === 'LOCKED' || value === 'HOLD') return 'warning' as const;
  return 'information' as const;
}
function byType(records: readonly FounderControlRecord[], type: FounderControlRecordType) {
  return records.filter((record) => record.recordType === type && record.status === 'ACTIVE');
}
function recordVersion(records: readonly FounderControlRecord[], type: FounderControlRecordType, key: string) {
  return records.find((record) => record.recordType === type && record.recordKey === key)?.version ?? '0';
}
function formObject(form: HTMLFormElement) {
  const data = new FormData(form); return Object.fromEntries([...data.entries()].map(([key,value]) => [key, String(value)]));
}

export function FounderControlCenter({ locale, csrfToken, initialBundle }: Props) {
  const copy = COPY[locale];
  const [tab, setTab] = useState<Tab>('today');
  const [bundle, setBundle] = useState(initialBundle);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const [overview, spec, records, events] = await Promise.all([
        fetch('/api/staff/founder-control/overview', { cache:'no-store', credentials:'same-origin' }),
        fetch('/api/staff/founder-control/spec', { cache:'no-store', credentials:'same-origin' }),
        fetch('/api/staff/founder-control/records', { cache:'no-store', credentials:'same-origin' }),
        fetch('/api/staff/founder-control/events?limit=30', { cache:'no-store', credentials:'same-origin' }),
      ]);
      if (![overview,spec,records,events].every((response) => response.ok)) throw new Error('Founder Control API unavailable');
      setBundle({
        available:true,
        overview: await overview.json(), spec: await spec.json(), records: await records.json(), events: await events.json(),
      });
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Founder Control API unavailable');
    } finally { setBusy(false); }
  }, []);

  const save = useCallback(async (
    type: FounderControlRecordType,
    key: string,
    payload: Record<string, unknown>,
    reason: string,
  ) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/staff/founder-control/records/${encodeURIComponent(type)}/${encodeURIComponent(key)}`, {
        method:'PUT', credentials:'same-origin', cache:'no-store',
        headers:{
          Accept:'application/json', 'Content-Type':'application/json', 'X-CSRF-Token':csrfToken,
          'Idempotency-Key': crypto.randomUUID(), 'X-Correlation-Id': crypto.randomUUID(),
        },
        body: JSON.stringify({
          payload, status:'ACTIVE', source:'FOUNDER_UI', reason,
          expectedVersion: recordVersion(bundle.records, type, key),
        }),
      });
      const body = await response.json().catch(() => ({})) as Record<string,unknown>;
      if (!response.ok) {
        if (response.status === 409) throw new Error('Данные изменились в другой сессии. Обнови страницу и повтори.');
        if (response.status === 403) throw new Error('Для изменения нужен подтверждённый PLATFORM_OWNER и свежая MFA.');
        throw new Error(typeof body.message === 'string' ? body.message : 'Не удалось сохранить.');
      }
      setNotice('Сохранено. Все связанные показатели и gates пересчитаны на сервере.');
      await reload();
    } catch (value) { setError(value instanceof Error ? value.message : 'Не удалось сохранить.'); }
    finally { setBusy(false); }
  }, [bundle.records, csrfToken, reload]);

  const overview = bundle.overview;
  const spec = bundle.spec;
  const metrics = overview?.metrics ?? {};
  const alerts = overview?.alerts ?? [];
  const p0 = alerts.filter((item) => item.severity === 'P0');
  const p1 = alerts.filter((item) => item.severity === 'P1');
  const firstAlert = p0[0] ?? p1[0] ?? null;
  const inputs = useMemo(() => Object.fromEntries(byType(bundle.records,'CEO_INPUT').map((record) => [record.recordKey, record.payload.value])), [bundle.records]);

  const saveInputs = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const values = formObject(event.currentTarget);
    const fields: Array<[string,string]> = [
      ['cashOnBankRub','cashOnBankRub'], ['committedFundingRub','committedFundingRub'], ['founderHours','founderHours'],
      ['engineerHours','engineerHours'], ['supportHours','supportHours'], ['infraMonthlyRub','infraMonthlyRub'],
    ];
    for (const [formKey, recordKey] of fields) {
      if (values[formKey] === '') continue;
      await save('CEO_INPUT', recordKey, { value:Number(values[formKey]) }, 'Обновление фактического показателя владельца');
    }
  };

  if (!bundle.available || !overview || !spec) {
    return (
      <section className={styles.unavailable} data-testid="founder-control-unavailable">
        <strong>Founder Control</strong><p>{copy.unavailable}</p>{error ? <code>{error}</code> : null}
        <button type="button" onClick={reload} disabled={busy}>{copy.refresh}</button>
      </section>
    );
  }

  return (
    <section className={styles.root} data-testid="founder-control-center">
      <header className={styles.hero}>
        <div><span className={styles.eyebrow}>{copy.eyebrow} · {overview.referenceVersion}</span><h1>{copy.title}</h1><p>{copy.description}</p></div>
        <div className={styles.healthBox}>
          <StatusChip tone={tone(overview.health)}>{overview.health}</StatusChip>
          <strong>{overview.healthScore.toFixed(0)}/100</strong><span>{overview.primaryValueLimiter}</span>
        </div>
      </header>

      {firstAlert ? (
        <section className={firstAlert.status === 'ALERT' ? styles.priorityCritical : styles.priorityEvidence}>
          <span>{firstAlert.severity} · {firstAlert.area}</span><h2>{firstAlert.title}</h2><p>{firstAlert.action}</p>
        </section>
      ) : <section className={styles.priorityGood}><span>STATUS</span><h2>Критических действий нет</h2><p>Продолжай фактическое обновление данных и monthly close.</p></section>}

      <div className={styles.metrics}>
        <Metric label="Cash" value={rub(metrics.cashOnBankRub,locale)} hint={`Runway ${metric(metrics.coreRunwayMonths,locale)} мес.`}/>
        <Metric label="MRR" value={rub(metrics.activeMrrRub,locale)} hint={`M6 BASE ${rub(metrics.m6MrrPlanRub,locale)}`}/>
        <Metric label="Qualified" value={metric(metrics.qualifiedOpenCount,locale)} hint={`Weighted ${rub(metrics.weightedPipelineMrrRub,locale)}`}/>
        <Metric label="Proof" value={`${metric(metrics.proofGroups,locale)}/2`} hint="independent groups"/>
        <Metric label="AR overdue" value={rub(metrics.overdueArRub,locale)} hint={`Open ${rub(metrics.openArRub,locale)}`}/>
        <Metric label="Scale" value={overview.gates.scaleBudget} hint={`stress ${rub(metrics.scaleStressRub,locale)}`}/>
      </div>

      <nav className={styles.tabs} aria-label="Founder Control sections">
        {TAB_KEYS.map((key,index) => <button key={key} type="button" aria-current={tab===key?'page':undefined} onClick={()=>setTab(key)}>{copy.tabs[index]}</button>)}
      </nav>

      {error ? <div className={styles.error}>{error}</div> : null}
      {notice ? <div className={styles.notice}>{notice}</div> : null}

      {tab === 'today' ? <Today overview={overview} p0={p0} p1={p1} locale={locale}/> : null}
      {tab === 'money' ? <Money records={bundle.records} inputs={inputs} onSaveInputs={saveInputs} onSave={save} locale={locale} busy={busy}/> : null}
      {tab === 'sales' ? <Sales records={bundle.records} onSave={save} locale={locale} busy={busy}/> : null}
      {tab === 'clients' ? <Clients records={bundle.records} onSave={save} locale={locale} busy={busy}/> : null}
      {tab === 'forecast' ? <Forecast records={bundle.records} spec={spec} onSave={save} locale={locale} busy={busy}/> : null}
      {tab === 'evidence' ? <Evidence records={bundle.records} spec={spec} onSave={save} locale={locale} busy={busy}/> : null}
      {tab === 'governance' ? <Governance records={bundle.records} events={bundle.events} onSave={save} locale={locale} busy={busy}/> : null}
      {tab === 'excel' ? <ExcelParity overview={overview} spec={spec}/> : null}

      <footer className={styles.footer}><span>{copy.updated}: {dateTime(overview.asOf,locale)}</span><button type="button" onClick={reload} disabled={busy}>{busy?'…':copy.refresh}</button></footer>
    </section>
  );
}

function Metric({label,value,hint}:{label:string;value:string;hint?:string}) { return <article className={styles.metric}><span>{label}</span><strong>{value}</strong>{hint?<small>{hint}</small>:null}</article>; }

function Today({overview,p0,p1,locale}:{overview:NonNullable<FounderControlBundle['overview']>;p0:readonly FounderControlAlert[];p1:readonly FounderControlAlert[];locale:AppLocale}) {
  return <div className={styles.twoCol}>
    <section className={`${styles.panel} ${styles.full}`}><h2>Company Health</h2><div className={styles.healthDimensions}>{overview.healthDimensions.map((item)=><div key={item.name}><div><strong>{item.name}</strong><span>{item.weight}%</span></div><div className={styles.healthTrack}><span style={{width:`${item.score}%`}}/></div><StatusChip tone={tone(item.status)}>{item.status}</StatusChip></div>)}</div></section>
    <section className={styles.panel}><h2>Gates</h2><div className={styles.gateGrid}>{Object.entries(overview.gates).map(([key,value])=><div key={key}><span>{key}</span><StatusChip tone={tone(value)}>{value}</StatusChip></div>)}</div></section>
    <section className={styles.panel}><h2>Очередь действий</h2>{p0.length===0&&p1.length===0?<p className={styles.muted}>Активных исключений нет.</p>:<div className={styles.alertList}>{[...p0,...p1].map((a)=><article key={a.id} className={styles.alert}><div><StatusChip tone={a.severity==='P0'?'critical':'warning'}>{a.severity}</StatusChip><strong>{a.title}</strong></div><p>{a.action}</p></article>)}</div>}</section>
    <section className={styles.panel}><h2>BASE, который нельзя забыть</h2><dl className={styles.definition}><div><dt>M6 MRR</dt><dd>{rub(overview.metrics.m6MrrPlanRub,locale)}</dd></div><div><dt>M6 recurring</dt><dd>{rub(overview.metrics.m6RecurringResultPlanRub,locale)}</dd></div><div><dt>Funding + reserve</dt><dd>{rub(overview.metrics.fundingPlusReservePlanRub,locale)}</dd></div><div><dt>+30d collections</dt><dd>{rub(overview.metrics.fundingWith30dCollectionsRub,locale)}</dd></div></dl></section>
    <section className={styles.panel}><h2>Главное правило</h2><p>Scale не открывается по календарю. Нужны 2 независимые proof-группы, legal/live PASS, реальный delivery backup, 7A+2S, runway ≥6 месяцев, концентрация ≤25% и подтверждённая инфраструктурная стоимость.</p></section>
  </div>;
}

type SaveFn=(type:FounderControlRecordType,key:string,payload:Record<string,unknown>,reason:string)=>Promise<void>;
function Money({records,inputs,onSaveInputs,onSave,locale,busy}:{records:readonly FounderControlRecord[];inputs:Record<string,unknown>;onSaveInputs:(e:FormEvent<HTMLFormElement>)=>void;onSave:SaveFn;locale:AppLocale;busy:boolean}) {
  const invoices=byType(records,'AR_INVOICE');
  const cashWeeks=byType(records,'CASH_WEEK').sort((a,b)=>(num(a.payload.week)??0)-(num(b.payload.week)??0));
  const addInvoice=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const v=formObject(e.currentTarget);await onSave('AR_INVOICE',`invoice-${v.invoiceId.trim()}`,{invoiceId:v.invoiceId,clientName:v.clientName,controlGroupId:v.controlGroupId,invoiceDate:v.invoiceDate,dueDate:v.dueDate,amountRub:Number(v.amountRub),paidAmountRub:Number(v.paidAmountRub||0),paidDate:v.paidDate||null,paymentEvidenceRef:v.paymentEvidenceRef},'Добавление/обновление дебиторки');e.currentTarget.reset();};
  const saveWeek=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const v=formObject(e.currentTarget);const week=Number(v.week);await onSave('CASH_WEEK',`week-${week}`,{week,weekStart:v.weekStart,confirmedRecurringRub:Number(v.confirmedRecurringRub||0),launchPrepayRub:Number(v.launchPrepayRub||0),fundingDrawRub:Number(v.fundingDrawRub||0),corePayrollVendorsRub:Number(v.corePayrollVendorsRub||0),clientVariableOnboardingRub:Number(v.clientVariableOnboardingRub||0),otherCommittedRub:Number(v.otherCommittedRub||0)},'Обновление подтверждённого 13-недельного cash calendar');};
  return <div className={styles.twoCol}>
    <section className={styles.panel}><h2>Cash / Runway</h2><form className={styles.formGrid} onSubmit={onSaveInputs}><Field name="cashOnBankRub" label="Деньги на счёте, ₽" type="number" defaultValue={inputs.cashOnBankRub}/><Field name="committedFundingRub" label="Подтверждённое финансирование, ₽" type="number" defaultValue={inputs.committedFundingRub}/><Field name="founderHours" label="Часы основателя / мес." type="number" defaultValue={inputs.founderHours}/><Field name="engineerHours" label="Часы инженера / мес." type="number" defaultValue={inputs.engineerHours}/><Field name="supportHours" label="Часы поддержки / мес." type="number" defaultValue={inputs.supportHours}/><Field name="infraMonthlyRub" label="Инфраструктура факт / мес., ₽" type="number" defaultValue={inputs.infraMonthlyRub}/><button disabled={busy}>Сохранить факты</button></form></section>
    <section className={styles.panel}><h2>13 недель cash</h2><form className={styles.formGrid} onSubmit={saveWeek}><Field name="week" label="Неделя 1–13" type="number" min="1" max="13" required/><Field name="weekStart" label="Начало недели" type="date" required/><Field name="confirmedRecurringRub" label="Confirmed recurring, ₽" type="number" defaultValue="0"/><Field name="launchPrepayRub" label="Launch prepay, ₽" type="number" defaultValue="0"/><Field name="fundingDrawRub" label="Funding draw, ₽" type="number" defaultValue="0"/><Field name="corePayrollVendorsRub" label="Payroll/vendors, ₽" type="number" defaultValue="0" required/><Field name="clientVariableOnboardingRub" label="Client/onboarding, ₽" type="number" defaultValue="0" required/><Field name="otherCommittedRub" label="Other committed, ₽" type="number" defaultValue="0" required/><button disabled={busy}>Сохранить неделю</button></form><p className={styles.muted}>Для полноценного PASS нужны все 13 недель. Введи 0 явно, если обязательства действительно нет.</p></section>
    <section className={styles.panel}><h2>Счёт / дебиторка</h2><form className={styles.formGrid} onSubmit={addInvoice}><Field name="invoiceId" label="Invoice ID / № счёта" pattern="[A-Za-z0-9._:-]+" required/><Field name="clientName" label="Клиент" required/><Field name="controlGroupId" label="Control Group ID" required/><Field name="invoiceDate" label="Дата счёта" type="date" required/><Field name="dueDate" label="Срок оплаты" type="date" required/><Field name="amountRub" label="Сумма, ₽" type="number" required/><Field name="paidAmountRub" label="Оплачено, ₽" type="number"/><Field name="paidDate" label="Дата оплаты" type="date"/><Field name="paymentEvidenceRef" label="Выписка / payment ref"/><button disabled={busy}>Сохранить / обновить счёт</button></form></section>
    <section className={styles.panel}><h2>13W записи</h2><RecordTable records={cashWeeks} locale={locale} columns={[['week','Неделя'],['weekStart','Старт'],['confirmedRecurringRub','Recurring'],['launchPrepayRub','Launch'],['fundingDrawRub','Funding'],['corePayrollVendorsRub','Core'],['clientVariableOnboardingRub','Client cost']]}/></section>
    <section className={`${styles.panel} ${styles.full}`}><h2>Дебиторка</h2><RecordTable records={invoices} locale={locale} columns={[['clientName','Клиент'],['amountRub','Сумма'],['paidAmountRub','Оплачено'],['dueDate','Срок'],['paidDate','Дата оплаты'],['paymentEvidenceRef','Evidence']]}/></section>
  </div>;
}

function Sales({records,onSave,locale,busy}:{records:readonly FounderControlRecord[];onSave:SaveFn;locale:AppLocale;busy:boolean}) {
  const items=byType(records,'PIPELINE_OPPORTUNITY');
  const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const v=formObject(e.currentTarget);await onSave('PIPELINE_OPPORTUNITY',`opp-${v.opportunityId.trim()}`,{opportunityId:v.opportunityId,companyName:v.companyName,controlGroupId:v.controlGroupId,stage:v.stage,qualified:v.qualified==='YES',package:v.package,mrrRub:Number(v.mrrRub),launchFeeRub:Number(v.launchFeeRub||0),status:v.status,closeDate:v.closeDate||null,expectedClose:v.expectedClose,nextStep:v.nextStep,nextStepDue:v.nextStepDue,source:v.source},'Новая возможность в коммерческой воронке');e.currentTarget.reset();};
  return <div className={styles.twoCol}><section className={styles.panel}><h2>Новая возможность</h2><form className={styles.formGrid} onSubmit={submit}><Field name="opportunityId" label="Opportunity ID" pattern="[A-Za-z0-9._:-]+" required/><Field name="companyName" label="Компания" required/><Field name="controlGroupId" label="Control Group ID"/><Select name="stage" label="Стадия" values={['NEW','DISCOVERY','QUALIFIED','DEMO','PROPOSAL','NEGOTIATION','VERBAL']} required/><Select name="qualified" label="Qualified?" values={['NO','YES']} required/><Select name="status" label="Статус" values={['OPEN','WON','LOST','HOLD']} required/><Field name="closeDate" label="Дата закрытия" type="date"/><Select name="package" label="Пакет" values={['Assisted','Self']} required/><Field name="mrrRub" label="MRR, ₽" type="number" required/><Field name="launchFeeRub" label="Запуск, ₽" type="number"/><Field name="expectedClose" label="Ожидаемое закрытие" type="date"/><Field name="nextStep" label="Следующий шаг" required/><Field name="nextStepDue" label="Срок шага" type="date"/><Field name="source" label="Источник"/><button disabled={busy}>Сохранить / обновить opportunity</button></form></section><section className={styles.panel}><h2>Как считать qualified</h2><p>Не просто контакт: подтверждённая проблема, понятный decision maker, экономический смысл и конкретный следующий шаг. Только такие возможности влияют на P0 pipeline.</p></section><section className={`${styles.panel} ${styles.full}`}><h2>Pipeline</h2><RecordTable records={items} locale={locale} columns={[['companyName','Компания'],['stage','Стадия'],['qualified','Qualified'],['mrrRub','MRR'],['expectedClose','Close'],['nextStep','Следующий шаг']]}/></section></div>;
}

function Clients({records,onSave,locale,busy}:{records:readonly FounderControlRecord[];onSave:SaveFn;locale:AppLocale;busy:boolean}) {
  const items=byType(records,'CLIENT');
  const retention=byType(records,'RETENTION_MRR');
  const submit=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault(); const v=formObject(e.currentTarget);
    await onSave('CLIENT',`client-${v.clientKey.trim()}`,{
      clientKey:v.clientKey,companyName:v.companyName,controlGroupId:v.controlGroupId,package:v.package,status:v.status,goLive:v.goLive,
      mrrRub:Number(v.mrrRub),launchFeeRub:Number(v.launchFeeRub),launchPrepayPct:Number(v.launchPrepayPct)/100,
      paymentTermsDays:Number(v.paymentTermsDays||0),supportHours:Number(v.supportHours||0),engineerHours:Number(v.engineerHours||0),
      otherDirectCostRub:Number(v.otherDirectCostRub||0),benefitRubPerMonth:Number(v.benefitRubPerMonth),integrationFunded:v.integrationFunded,
      launchPrepayReceived:v.launchPrepayReceived==='YES',paymentEvidenceRef:v.paymentEvidenceRef,repeatPaid:v.repeatPaid==='YES',lastPaidAt:v.lastPaidAt||null,
      roiEvidence:v.roiEvidence==='YES',costMeasured:v.costMeasured==='YES',actualLaunchCostRub:v.actualLaunchCostRub?Number(v.actualLaunchCostRub):undefined,
      pnlMonth:v.pnlMonth||undefined,actualRecurringRevenueRub:v.actualRecurringRevenueRub?Number(v.actualRecurringRevenueRub):undefined,
      actualLaunchRevenueRub:v.actualLaunchRevenueRub?Number(v.actualLaunchRevenueRub):undefined,actualSupportHours:v.actualSupportHours?Number(v.actualSupportHours):undefined,
      actualEngineerHours:v.actualEngineerHours?Number(v.actualEngineerHours):undefined,actualOtherDirectCostRub:v.actualOtherDirectCostRub?Number(v.actualOtherDirectCostRub):undefined,
      actualInfraAllocationRub:v.actualInfraAllocationRub?Number(v.actualInfraAllocationRub):undefined,
    },'Добавление/обновление клиентской экономики'); e.currentTarget.reset();
  };
  const submitRetention=async(e:FormEvent<HTMLFormElement>)=>{
    e.preventDefault(); const v=formObject(e.currentTarget); if(!v.clientKey)return;
    await onSave('RETENTION_MRR',`${v.clientKey}:period-${v.period}`,{clientKey:v.clientKey,period:Number(v.period),mrrRub:Number(v.mrrRub)},'Фактический MRR клиента для GRR/NRR'); e.currentTarget.reset();
  };
  return <div className={styles.twoCol}>
    <section className={styles.panel}><h2>Клиент / proof / P&amp;L</h2><form className={styles.formGrid} onSubmit={submit}>
      <Field name="clientKey" label="Client ID / ИНН" pattern="[A-Za-z0-9._:-]+" required/><Field name="companyName" label="Компания" required/><Field name="controlGroupId" label="Control Group ID" required/>
      <Select name="package" label="Пакет" values={['Assisted','Self']} required/><Select name="status" label="Статус" values={['SIGNED','ACTIVE','PAUSED','CHURNED']} required/>
      <Field name="goLive" label="Go-live" type="date"/><Field name="mrrRub" label="MRR, ₽" type="number" required/>
      <Field name="launchFeeRub" label="Запуск, ₽" type="number" required/><Field name="launchPrepayPct" label="Предоплата запуска, %" type="number" defaultValue="70" required/>
      <Field name="paymentTermsDays" label="Отсрочка, дней" type="number" defaultValue="0"/><Field name="supportHours" label="Support h/mo (план)" type="number"/>
      <Field name="engineerHours" label="Engineer h/mo (план)" type="number"/><Field name="otherDirectCostRub" label="Прочие direct cost, ₽" type="number"/>
      <Field name="benefitRubPerMonth" label="Выгода клиента / мес., ₽" type="number" required/><Select name="integrationFunded" label="Интеграция оплачена?" values={['N/A','YES','NO']} required/>
      <Select name="launchPrepayReceived" label="Предоплата получена?" values={['NO','YES']}/><Field name="paymentEvidenceRef" label="Payment evidence/ref"/>
      <Select name="repeatPaid" label="Repeat paid?" values={['NO','YES']}/><Field name="lastPaidAt" label="Дата repeat payment" type="date"/>
      <Select name="roiEvidence" label="ROI доказан?" values={['NO','YES']}/><Select name="costMeasured" label="Себестоимость измерена?" values={['NO','YES']}/>
      <Field name="actualLaunchCostRub" label="Факт. cost запуска, ₽" type="number"/><Field name="pnlMonth" label="P&L месяц" type="date"/>
      <Field name="actualRecurringRevenueRub" label="Факт recurring revenue, ₽" type="number"/><Field name="actualLaunchRevenueRub" label="Факт launch revenue, ₽" type="number"/>
      <Field name="actualSupportHours" label="Support h факт" type="number"/><Field name="actualEngineerHours" label="Engineer h факт" type="number"/>
      <Field name="actualOtherDirectCostRub" label="Прочие cost факт, ₽" type="number"/><Field name="actualInfraAllocationRub" label="Infra allocation факт, ₽" type="number"/>
      <button disabled={busy}>Сохранить клиента</button>
    </form></section>
    <section className={styles.panel}><h2>Когда клиент = proof</h2><p>ACTIVE + экономический Contract Gate PASS + реальная предоплата с evidence + repeat payment + ROI + measured cost + фактическая стоимость запуска. Две компании одного Control Group считаются одной proof-группой.</p><p>Client P&amp;L становится доказанным только после фактических revenue, hours, direct costs и infra allocation — пустые значения не считаются нулём.</p></section>
    <section className={styles.panel}><h2>Retention / GRR / NRR</h2>{items.length===0?<p className={styles.muted}>Сначала добавь клиента.</p>:<form className={styles.formGrid} onSubmit={submitRetention}><label className={styles.field}><span>Клиент</span><select name="clientKey" required>{items.map((item)=><option key={item.recordKey} value={item.recordKey}>{str(item.payload.companyName)||item.recordKey}</option>)}</select></label><Field name="period" label="Период 1–12" type="number" min="1" max="12" required/><Field name="mrrRub" label="Фактический MRR, ₽" type="number" required/><button disabled={busy}>Записать MRR периода</button></form>}<small className={styles.muted}>Retention rows: {retention.length}. Пустой период остаётся EVIDENCE, а не нулём.</small></section>
    <section className={`${styles.panel} ${styles.full}`}><h2>Клиенты</h2><RecordTable records={items} locale={locale} columns={[['companyName','Компания'],['controlGroupId','Группа'],['package','Пакет'],['status','Статус'],['mrrRub','MRR'],['repeatPaid','Repeat'],['roiEvidence','ROI'],['actualLaunchCostRub','Launch cost факт']]}/></section>
  </div>;
}

function Forecast({records,spec,onSave,locale,busy}:{records:readonly FounderControlRecord[];spec:NonNullable<FounderControlBundle['spec']>;onSave:SaveFn;locale:AppLocale;busy:boolean}) {
  const forecasts=byType(records,'FORECAST'); const actuals=byType(records,'ACTUAL_PERIOD');
  const submitForecast=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const v=formObject(e.currentTarget);await onSave('FORECAST',`period-${v.period}`,{period:Number(v.period),forecastMrrRub:Number(v.mrrRub),forecastRecurringResultRub:Number(v.resultRub),forecastClients:Number(v.clients),approvedAt:v.approvedAt,approvalEvidenceRef:v.approvalEvidenceRef},'Утверждённый rolling forecast до начала периода');};
  const submitActual=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const v=formObject(e.currentTarget);await onSave('ACTUAL_PERIOD',`period-${v.period}`,{period:Number(v.period),actualMrrRub:Number(v.mrrRub),actualRecurringResultRub:Number(v.resultRub),actualClients:Number(v.clients),qualifiedOpportunities:Number(v.qualified||0)},'Фактическое закрытие периода');};
  return <div className={styles.twoCol}><section className={styles.panel}><h2>Утвердить forecast</h2><form className={styles.formGrid} onSubmit={submitForecast}><Field name="period" label="Период 1–12" type="number" min="1" max="12" required/><Field name="mrrRub" label="Forecast MRR, ₽" type="number" required/><Field name="resultRub" label="Forecast recurring result, ₽" type="number" required/><Field name="clients" label="Forecast clients" type="number" required/><Field name="approvedAt" label="Дата утверждения" type="date" required/><Field name="approvalEvidenceRef" label="Approval evidence/ref" required/><button disabled={busy}>Зафиксировать forecast</button></form></section><section className={styles.panel}><h2>Внести факт периода</h2><form className={styles.formGrid} onSubmit={submitActual}><Field name="period" label="Период 1–12" type="number" min="1" max="12" required/><Field name="mrrRub" label="Actual MRR, ₽" type="number" required/><Field name="resultRub" label="Actual recurring result, ₽" type="number" required/><Field name="clients" label="Actual clients" type="number" required/><Field name="qualified" label="Qualified opps" type="number"/><button disabled={busy}>Записать факт</button></form></section><section className={`${styles.panel} ${styles.full}`}><h2>BASE 12М</h2><div className={styles.tableWrap}><table><thead><tr><th>P</th><th>A</th><th>S</th><th>MRR</th><th>Recurring result</th></tr></thead><tbody>{spec.basePlan.map((row)=><tr key={row.period}><td>{row.period}</td><td>{row.activeAssisted}</td><td>{row.activeSelf}</td><td>{rub(row.mrrRub,locale)}</td><td>{rub(row.recurringResultRub,locale)}</td></tr>)}</tbody></table></div><small className={styles.muted}>Forecast records: {forecasts.length} · actual periods: {actuals.length}</small></section></div>;
}

function Evidence({records,spec,onSave,locale,busy}:{records:readonly FounderControlRecord[];spec:NonNullable<FounderControlBundle['spec']>;onSave:SaveFn;locale:AppLocale;busy:boolean}) {
  const items=byType(records,'EVIDENCE');
  const requirements=Object.entries(spec.evidenceRequirements).flatMap(([gate,codes])=>codes.map((code)=>({gate,code})));
  const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const v=formObject(e.currentTarget);const [gate,itemCode]=v.requirement.split(':');await onSave('EVIDENCE',`evidence-${gate}-${itemCode}`,{gate,itemCode,item:v.item||itemCode,required:true,status:v.status,ref:v.ref,verifiedBy:v.verifiedBy,checkedAt:v.checkedAt},'Добавление проверяемого evidence для управленческого gate');};
  return <div className={styles.twoCol}><section className={styles.panel}><h2>Добавить evidence</h2><form className={styles.formGrid} onSubmit={submit}><label className={styles.field}><span>Обязательный пункт</span><select name="requirement" required>{requirements.map(({gate,code})=><option key={`${gate}:${code}`} value={`${gate}:${code}`}>{gate} · {code}</option>)}</select></label><Field name="item" label="Пояснение"/><Select name="status" label="Статус" values={['EVIDENCE','PASS']} required/><Field name="ref" label="Документ / ссылка / ref" required/><Field name="verifiedBy" label="Кто проверил" required/><Field name="checkedAt" label="Дата проверки" type="date" required/><button disabled={busy}>Сохранить evidence</button></form></section><section className={styles.panel}><h2>Что нужно для PASS</h2><div className={styles.requirements}>{Object.entries(spec.evidenceRequirements).map(([gate,codes])=><div key={gate}><strong>{gate}</strong><ul>{codes.map((code)=>{const present=items.some((record)=>str(record.payload.gate)===gate&&str(record.payload.itemCode)===code&&str(record.payload.status)==='PASS'&&Boolean(str(record.payload.ref))&&Boolean(str(record.payload.verifiedBy)));return <li key={code} className={present?styles.done:undefined}>{present?'✓':'○'} {code}</li>;})}</ul></div>)}</div></section><section className={`${styles.panel} ${styles.full}`}><h2>Evidence Register</h2><RecordTable records={items} locale={locale} columns={[['gate','Gate'],['itemCode','Пункт'],['status','Status'],['ref','Ref'],['verifiedBy','Verified by'],['checkedAt','Checked']]}/></section></div>;
}

function Governance({records,events,onSave,locale,busy}:{records:readonly FounderControlRecord[];events:FounderControlBundle['events'];onSave:SaveFn;locale:AppLocale;busy:boolean}) {
  const assumptions=byType(records,'ASSUMPTION_CHANGE'); const closes=byType(records,'MONTHLY_CLOSE'); const decisions=byType(records,'DECISION');
  const assumption=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const v=formObject(e.currentTarget);await onSave('ASSUMPTION_CHANGE',`assumption-${crypto.randomUUID()}`,{area:v.area,metric:v.metric,sourceCell:v.sourceCell,oldValue:v.oldValue,newValue:v.newValue,financialImpact:v.financialImpact,reason:v.reason,approvedBy:v.approvedBy,evidenceRef:v.evidenceRef,revisitDate:v.revisitDate},'Фиксация изменения ключевого допущения');e.currentTarget.reset();};
  const close=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const v=formObject(e.currentTarget);await onSave('MONTHLY_CLOSE',`period-${v.period}`,{period:Number(v.period),bankReconciled:v.bankReconciled==='YES',arReconciled:v.arReconciled==='YES',revenueVerified:v.revenueVerified==='YES',clientPnlComplete:v.clientPnlComplete==='YES',payrollVendorsEntered:v.payrollVendorsEntered==='YES',taxReserveChecked:v.taxReserveChecked==='YES',evidenceCurrent:v.evidenceCurrent==='YES',cashForecastRolled:v.cashForecastRolled==='YES',forecastApproved:v.forecastApproved==='YES',owner:v.owner,closedAt:v.closedAt,evidenceRef:v.evidenceRef},'Закрытие управленческого месяца');};
  const decision=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const v=formObject(e.currentTarget);await onSave('DECISION',`decision-${crypto.randomUUID()}`,{area:v.area,decision:v.decision,trigger:v.trigger,expectedImpact:v.expectedImpact,owner:v.owner,revisitDate:v.revisitDate,evidenceRef:v.evidenceRef},'Управленческое решение Founder Control');e.currentTarget.reset();};
  return <div className={styles.twoCol}><section className={styles.panel}><h2>Изменение допущения</h2><form className={styles.formGrid} onSubmit={assumption}><Field name="area" label="Область" required/><Field name="metric" label="Допущение / метрика" required/><Field name="sourceCell" label="Источник / Excel cell" required/><Field name="oldValue" label="Было" required/><Field name="newValue" label="Стало" required/><Field name="financialImpact" label="Финансовое влияние" required/><Field name="reason" label="Почему" required/><Field name="approvedBy" label="Кто утвердил" required/><Field name="evidenceRef" label="Evidence/ref" required/><Field name="revisitDate" label="Пересмотреть" type="date"/><button disabled={busy}>Зафиксировать изменение</button></form></section><section className={styles.panel}><h2>Monthly close</h2><form className={styles.formGrid} onSubmit={close}><Field name="period" label="Период 1–12" type="number" min="1" max="12" required/><Select name="bankReconciled" label="Банк сверён?" values={['NO','YES']} required/><Select name="arReconciled" label="Дебиторка сверена?" values={['NO','YES']} required/><Select name="revenueVerified" label="Revenue / MRR подтверждены?" values={['NO','YES']} required/><Select name="clientPnlComplete" label="Client P&L закрыт?" values={['NO','YES']} required/><Select name="payrollVendorsEntered" label="Payroll / vendors внесены?" values={['NO','YES']} required/><Select name="taxReserveChecked" label="Tax reserve проверен?" values={['NO','YES']} required/><Select name="evidenceCurrent" label="Evidence актуален?" values={['NO','YES']} required/><Select name="cashForecastRolled" label="13W cash обновлён?" values={['NO','YES']} required/><Select name="forecastApproved" label="Forecast утверждён?" values={['NO','YES']} required/><Field name="owner" label="Ответственный" required/><Field name="closedAt" label="Дата закрытия" type="date" required/><Field name="evidenceRef" label="Close evidence/ref" required/><button disabled={busy}>Закрыть период</button></form><p className={styles.muted}>Все 9 пунктов фиксируются отдельно. Любой NO = BLOCK; незаполненный пункт или отсутствие evidence ref = EVIDENCE.</p></section><section className={styles.panel}><h2>Decision Log</h2><form className={styles.formGrid} onSubmit={decision}><Field name="area" label="Область" required/><Field name="decision" label="Решение" required/><Field name="trigger" label="Trigger / metric" required/><Field name="expectedImpact" label="Ожидаемое влияние" required/><Field name="owner" label="Ответственный" required/><Field name="revisitDate" label="Пересмотреть" type="date"/><Field name="evidenceRef" label="Evidence/ref"/><button disabled={busy}>Записать решение</button></form></section><section className={styles.panel}><h2>Audit trail</h2><div className={styles.eventList}>{events.length?events.map((event)=><article key={event.id}><strong>{event.recordType} · {event.recordKey}</strong><span>{event.action} · v{event.aggregateVersion} · {dateTime(event.createdAt,locale)}</span><small>{event.reason}</small></article>):<p className={styles.muted}>Событий пока нет.</p>}</div></section><section className={`${styles.panel} ${styles.full}`}><p className={styles.muted}>Assumption changes: {assumptions.length} · closes: {closes.length} · decisions: {decisions.length}. История изменений в PostgreSQL append-only и содержит hash chain.</p></section></div>;
}

function ExcelParity({overview,spec}:{overview:NonNullable<FounderControlBundle['overview']>;spec:NonNullable<FounderControlBundle['spec']>}) { return <section className={styles.panel}><h2>Excel v11.2 сохранён 1:1 как frozen reference</h2><p>Ни один лист не выброшен: каждому листу назначен модуль в Founder Control. Рабочая authority — PostgreSQL и server gates; оригинальный Excel остаётся независимым audit artifact, а его identity зафиксирована checksum.</p><dl className={styles.definition}><div><dt>Файл</dt><dd>{spec.referenceArtifact.fileName}</dd></div><div><dt>Размер</dt><dd>{metric(spec.referenceArtifact.sizeBytes,'ru')} bytes</dd></div><div><dt>SHA-256</dt><dd className={styles.hash}>{spec.referenceArtifact.sha256}</dd></div></dl><div className={styles.parity}>{overview.workbookParity.map((item)=><div key={item.sheet}><strong>{item.sheet}</strong><span>→ {item.module}</span></div>)}</div></section>; }

function Field({name,label,type='text',defaultValue,required,min,max,pattern}:{name:string;label:string;type?:string;defaultValue?:unknown;required?:boolean;min?:string;max?:string;pattern?:string}) { return <label className={styles.field}><span>{label}</span><input name={name} type={type} defaultValue={defaultValue == null?'':String(defaultValue)} required={required} min={min} max={max} pattern={pattern}/></label>; }
function Select({name,label,values,required}:{name:string;label:string;values:string[];required?:boolean}) { return <label className={styles.field}><span>{label}</span><select name={name} required={required}>{values.map((value)=><option key={value} value={value}>{value}</option>)}</select></label>; }
function RecordTable({records,columns,locale}:{records:readonly FounderControlRecord[];columns:Array<[string,string]>;locale:AppLocale}) { if(!records.length)return <p className={styles.muted}>Пока нет записей.</p>; return <div className={styles.tableWrap}><table><thead><tr><th>ID</th>{columns.map(([,label])=><th key={label}>{label}</th>)}<th>Обновлено</th></tr></thead><tbody>{records.map((record)=><tr key={record.id}><td className={styles.recordKey}>{record.recordKey}</td>{columns.map(([key])=><td key={key}>{renderCell(record.payload[key],key,locale)}</td>)}<td>{dateTime(record.updatedAt,locale)}</td></tr>)}</tbody></table></div>; }
function renderCell(value:unknown,key:string,locale:AppLocale){if(value==null||value==='')return'—';if(typeof value==='boolean')return value?'YES':'NO';if(typeof value==='number'){if(/rub|fee|mrr|cost|amount/i.test(key))return rub(value,locale);if(/pct|share|rate/i.test(key))return percent(value,locale);return metric(value,locale);}return String(value);}
