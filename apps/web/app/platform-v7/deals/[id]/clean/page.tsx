import '@/styles/platform-v7-canonical-public-v1.css';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { DealChangeHistory } from '@/components/platform-v7/DealChangeHistory';
import { DealGuaranteesBlock } from '@/components/platform-v7/DealGuaranteesBlock';
import { P7DealWorkspaceTabs } from '@/components/platform-v7/P7DealWorkspaceTabs';
import {
  CanonicalDealSpine,
  CanonicalGektaStrip,
  CanonicalStateLens,
  CanonicalTrustLedger,
  canonicalPublicLocale,
  type CanonicalDealState,
} from '@/components/platform-v7/PublicCanonicalPrimitives';
import { canonicalDomainDeals, selectDealById, selectDisputesByDealId } from '@/lib/domain/selectors';
import { evaluateReleaseGuard } from '@/lib/platform-v7/domain/release-guard';
import { moneyStopReasonText } from '@/lib/platform-v7/domain/money-stop-labels';
import { getDeal360Scenario } from '@/lib/platform-v7/deal360-source-of-truth';
import { buildP7DealWorkspaceRuntimeBinding, type P7WorkspaceRuntimeBinding } from '@/lib/platform-v7/deal-workspace-runtime-binding';

export default async function PlatformV7CleanDealPage(props:{params:Promise<{id:string}>}){
  const [{id}, rawLocale]=await Promise.all([props.params,getLocale()]);
  const locale=canonicalPublicLocale(rawLocale);
  const deal=selectDealById(id);

  if(!deal){
    return <main className='pc-canonical-deal'>
      <section className='pc-cp-card pc-cp-empty'><div><strong>{locale==='ru'?'Сделка не найдена':locale==='en'?'Deal not found':'未找到交易'}</strong><span>{locale==='ru'?'Серверный доменный контур не вернул доступную Сделку. Данные не подменяются примером.':locale==='en'?'The server-side domain context returned no accessible Deal. No sample data is substituted.':'服务器端域上下文没有返回可访问交易；不会用示例数据替代。'}</span><Link className='pc-cp-button pc-cp-button--secondary' href='/platform-v7/deals'>{locale==='ru'?'Все сделки':locale==='en'?'All Deals':'全部交易'}</Link></div></section>
    </main>;
  }

  const disputes=selectDisputesByDealId(deal.id);
  const scenario=getDeal360Scenario(deal.id);
  const binding=buildP7DealWorkspaceRuntimeBinding({deal,disputes,scenarioReleaseAllowed:scenario.releaseAllowed});
  const canonicalDeal=canonicalDomainDeals.find((item)=>item.id===deal.id);
  const releaseCheck=canonicalDeal?evaluateReleaseGuard(canonicalDeal):null;
  const releaseReasons=releaseCheck?.blockers??[];
  const hasBlockers=binding.blocked||releaseReasons.length>0||deal.blockers.length>0||deal.holdAmount>0||disputes.some((d)=>d.status==='open');
  const state:CanonicalDealState=disputes.some((d)=>d.status==='open')?'dispute':hasBlockers?'deviation':'normal';
  const currentIndex=canonicalStageIndex(binding);
  const settlementText=releaseReasons.length>0
    ? moneyStopReasonText(releaseReasons)
    : binding.blockedReason
      ? binding.blockedReason
      : locale==='ru'
        ? 'Подтверждённые основания позволяют двигаться дальше; внешнее финансовое событие остаётся отдельным банковским подтверждением.'
        : locale==='en'
          ? 'Confirmed basis permits progress; the external financial event remains a separate banking confirmation.'
          : '已确认依据允许继续；外部金融事件仍需单独银行确认。';

  return <main className='pc-canonical-deal' data-testid='canonical-deal-workspace'>
    <section className='pc-cp-card pc-cp-deal-header'>
      <div className='pc-cp-deal-header-row'>
        <div>
          <span className='pc-cp-eyebrow'>{locale==='ru'?'Сделка в работе':locale==='en'?'Deal in progress':'进行中的交易'}</span>
          <h1>{deal.grain} · {deal.quantity} {deal.unit}</h1>
          <div className='pc-cp-deal-meta'><span>{deal.id}</span><span>·</span><span>{binding.statusLabel}</span></div>
        </div>
        <span className={`pc-cp-chip ${state==='normal'?'pc-cp-chip--ok':state==='dispute'?'pc-cp-chip--danger':'pc-cp-chip--warn'}`}>
          {state==='normal'?(locale==='ru'?'Норма':locale==='en'?'Normal':'正常'):state==='dispute'?(locale==='ru'?'Спор':locale==='en'?'Dispute':'争议'):(locale==='ru'?'Отклонение':locale==='en'?'Deviation':'偏差')}
        </span>
      </div>
    </section>

    <div className='pc-cp-deal-columns'>
      <aside className='pc-cp-card pc-cp-deal-side'>
        <span className='pc-cp-eyebrow'>{locale==='ru'?'Контекст':locale==='en'?'Context':'上下文'}</span>
        <h2>{binding.statusLabel}</h2>
        <dl>
          <Row label={locale==='ru'?'Сделка':locale==='en'?'Deal':'交易'} value={deal.id}/>
          <Row label={locale==='ru'?'Культура':locale==='en'?'Crop':'作物'} value={deal.grain}/>
          <Row label={locale==='ru'?'Объём':locale==='en'?'Volume':'数量'} value={`${deal.quantity} ${deal.unit}`}/>
          <Row label={locale==='ru'?'Следующий участник':locale==='en'?'Next participant':'下一参与方'} value={binding.nextOwner}/>
          <Row label={locale==='ru'?'Состояние':locale==='en'?'State':'状态'} value={state==='normal'?(locale==='ru'?'Норма':locale==='en'?'Normal':'正常'):state==='dispute'?(locale==='ru'?'Спор':locale==='en'?'Dispute':'争议'):(locale==='ru'?'Отклонение':locale==='en'?'Deviation':'偏差')}/>
        </dl>
        <div className='pc-cp-actions' style={{marginTop:14,display:'grid'}}>
          <Link className='pc-cp-button pc-cp-button--secondary' href='/platform-v7/deals'>{locale==='ru'?'Все сделки':locale==='en'?'All Deals':'全部交易'}</Link>
          <Link className='pc-cp-button pc-cp-button--secondary' href={`/platform-v7/deals/${deal.id}/documents`}>{locale==='ru'?'Документы':locale==='en'?'Documents':'文件'}</Link>
        </div>
      </aside>

      <div className='pc-cp-deal-main'>
        <section className='pc-cp-card pc-cp-state-shell'>
          <span className='pc-cp-eyebrow'>{locale==='ru'?'7 этапов':locale==='en'?'7 stages':'7 个阶段'}</span>
          <CanonicalDealSpine locale={locale} currentIndex={currentIndex}/>
        </section>

        <CanonicalStateLens
          locale={locale}
          state={state}
          happened={binding.blockedReason??binding.statusLabel}
          actor={binding.nextOwner}
          basis={binding.actionBoundary.safeReason}
          settlement={settlementText}
          next={binding.nextStepInstruction}
        />

        <section className='pc-cp-card pc-cp-state-shell'>
          <div className='pc-cp-section-head' style={{marginBottom:14}}>
            <span className='pc-cp-eyebrow'>{locale==='ru'?'Что делать сейчас':locale==='en'?'What to do now':'现在做什么'}</span>
            <h2>{binding.nextStepTitle}</h2>
            <p>{binding.nextStepInstruction}</p>
          </div>
          <div className='pc-cp-capabilities'>
            {binding.pillars.map((pillar)=><article className='pc-cp-card pc-cp-capability' key={pillar.id}>
              <strong>{pillar.title}</strong><p>{pillar.value}</p><span className={`pc-cp-chip ${pillar.state==='blocked'?'pc-cp-chip--danger':pillar.state==='done'?'pc-cp-chip--ok':'pc-cp-chip--warn'}`}>{pillar.hint}</span>
            </article>)}
          </div>
        </section>

        <section className='pc-cp-card pc-cp-state-shell'>
          <div className='pc-cp-section-head' style={{marginBottom:14}}>
            <span className='pc-cp-eyebrow'>{locale==='ru'?'Доверие':locale==='en'?'Trust':'信任'}</span>
            <h2>{locale==='ru'?'Полномочия → Основание → Источник → Решение':locale==='en'?'Authority → Basis → Source → Decision':'权限 → 依据 → 来源 → 决定'}</h2>
          </div>
          <CanonicalTrustLedger locale={locale}/>
        </section>

        <CanonicalGektaStrip locale={locale}/>

        <DealGuaranteesBlock dealId={deal.id} reservedAmount={deal.reservedAmount} holdAmount={deal.holdAmount} releaseBlocked={hasBlockers}/>
        <P7DealWorkspaceTabs deal={deal} runtimeBinding={binding}/>

        <section className='pc-cp-card pc-cp-state-shell'>
          <CollapsibleSection title={locale==='ru'?'История изменений':locale==='en'?'Change history':'变更历史'} summary={locale==='ru'?'события · блокеры · документы · решения':locale==='en'?'events · blockers · documents · decisions':'事件 · 阻断 · 文件 · 决定'} defaultOpen={false}>
            <DealChangeHistory dealId={deal.id}/>
          </CollapsibleSection>
        </section>
      </div>
    </div>
  </main>;
}

function canonicalStageIndex(binding:P7WorkspaceRuntimeBinding){
  const current=binding.journey.find((step)=>step.state==='current'||step.state==='blocked')?.id??'close';
  if(current==='price')return 0;
  if(current==='reserve')return 2;
  if(current==='logistics')return 3;
  if(current==='acceptance'||current==='lab')return 4;
  if(current==='documents'||current==='bank_basis')return 5;
  return 6;
}
function Row({label,value}:{label:string;value:string}){return <div><dt>{label}</dt><dd>{value}</dd></div>}
