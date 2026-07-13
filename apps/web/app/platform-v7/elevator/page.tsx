import {
  KeyFact,
  KeyFactGrid,
  NextActionPanel,
  StatusBadge,
  Surface,
} from '@pc/design-system-v8';
import { IntakeWorkbenchTemplate } from '@/components/transaction-ux/FieldTaskTemplate';
import workspace from '@/components/transaction-ux/FieldRoleWorkspace.module.css';
import { getLabSamples, pendingProtocols } from '@/lib/labs-server';
import { getShipments, activeShipmentCount } from '@/lib/logistics-server';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { FieldElevatorRuntime } from '@/components/v7r/FieldElevatorRuntime';
import { RoleExecutionHandoff, type HandoffItem } from '@/components/platform-v7/RoleExecutionHandoff';
import { EvidenceReadinessMiniMatrix } from '@/components/platform-v7/EvidenceReadinessMiniMatrix';
import { DecisionRecommendationStrip } from '@/components/platform-v7/DecisionRecommendationStrip';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { SmartSectionSummary } from '@/components/platform-v7/visual/SmartSectionSummary';
import { WeighStationPanel } from '@/components/platform-v7/WeighStationPanel';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { DL_9106_ELEVATOR_RECEIVING } from '@/lib/platform-v7/deal-execution-source-of-truth';

const elevatorHandoff: HandoffItem[] = [
  { direction: 'sends', role: 'элеватор → контур документов', requirement: 'акт приёмки и акт расхождения в контур документов', documentImpact: true, moneyImpact: true },
  { direction: 'sends', role: 'элеватор → лабораторный контур качества', requirement: 'проба и показатели качества — в протокол качества', documentImpact: true },
  { direction: 'awaits', role: 'от логистики', requirement: 'рейс с ЭТрН и данными водителя перед началом приёмки', documentImpact: true },
  { direction: 'blockedBy', requirement: 'отклонение веса -1,2 т — нужен акт расхождения до дальнейшей проверки', documentImpact: true, moneyImpact: true },
  { direction: 'next', requirement: 'зафиксировать вес, подписать акт приёмки и передать пробу в лабораторию', entity: 'TRIP-2403-001', documentImpact: true },
];

const receiving = DL_9106_ELEVATOR_RECEIVING.snapshot;
const quality = DL_9106_ELEVATOR_RECEIVING.quality;

const intakeChecklist = [
  { label: 'Рейс', value: 'TRIP-2403-001 прибыл', note: 'назначение и партия подтверждены' },
  { label: 'Вес', value: '598,8 т принято', note: 'отклонение -1,2 т требует акта' },
  { label: 'Проба', value: 'передать в лабораторию', note: 'протокол качества ещё не закрыт' },
  { label: 'Результат', value: 'акт приёмки', note: 'без него документное основание неполно' },
] as const;

const gates = [
  { title: 'Вес', value: 'отклонение -1,2 т', impact: 'создаёт остановку до акта расхождения', tone: 'danger' as const },
  { title: 'Качество', value: 'превышение по примеси', impact: 'требует протокол качества', tone: 'warning' as const },
  { title: 'Акт приёмки', value: 'готовится', impact: 'без акта основание не передаётся дальше', tone: 'warning' as const },
  { title: 'Протокол', value: 'ожидается', impact: 'закрывает качество партии', tone: 'neutral' as const },
];

export default async function Page() {
  const [samples, shipments] = await Promise.all([getLabSamples(), getShipments()]);
  const pendingSamples = pendingProtocols(samples);
  const shipmentCount = activeShipmentCount(shipments);
  const apiOnline = samples.some((sample) => !sample.id.startsWith('SAMPLE-00'));

  const liveBlockers = pendingSamples.slice(0, 3).map((sample) => ({
    id: sample.id,
    label: `Проба ${sample.id}: протокол качества ожидается`,
    severity: 'warn' as const,
    responsibleRole: 'ELEVATOR',
    nextAction: 'Передать пробу в лабораторию',
  }));

  const liveStatus = (
    <LiveApiStatusBar
      apiOnline={apiOnline}
      blockers={liveBlockers}
      activeShipments={shipmentCount}
      role='ELEVATOR · Приёмка'
      summary={apiOnline
        ? `${shipmentCount} рейсов на приёмке · ${pendingSamples.length} проб ожидают протокола`
        : 'Данные статичные — API недоступен'}
    />
  );

  const primary = (
    <div className={workspace.stack}>
      <NextActionPanel
        eyebrow='Текущий объект приёмки'
        title='Зафиксировать вес и оформить акт расхождения'
        description='Рейс прибыл. Фактический вес ниже заявленного на 1,2 т. После фиксации веса передай пробу в лабораторию.'
        blocker='акт расхождения и протокол качества не закрыты'
        deadline='до передачи документного основания'
        action={<a className={workspace.primaryLink} href='#weight'>Открыть фиксацию веса</a>}
        secondaryAction={<a className={workspace.secondaryLink} href='#quality'>Передать пробу</a>}
      />

      <KeyFactGrid>
        <KeyFact label='Рейс' value={receiving.tripId} hint={receiving.lotId} />
        <KeyFact label='Заявлено' value={receiving.declaredWeight} hint={receiving.crop} />
        <KeyFact label='Принято' value={receiving.arrivedWeight} hint={`отклонение ${receiving.deviation}`} />
        <KeyFact label='Следующий результат' value='акт приёмки' hint='и проба в лабораторию' />
      </KeyFactGrid>

      <QuietIntelligenceHint
        problem='Отклонение веса -1,2 т и превышение по сорной примеси — акт расхождения не подписан.'
        action='Зафиксировать вес, подписать акт приёмки и акт расхождения, передать пробу в лабораторию.'
        outcome='После закрытия актов основание перейдёт в контур документов для дальнейшей проверки.'
      />

      <section id='weight' className={workspace.sectionAnchor}>
        <CollapsibleSection title='Вес и активная приёмка' summary='598,8 т · отклонение -1,2 т' defaultOpen>
          <div className={workspace.sectionStack}>
            <WeighStationPanel
              tripId={receiving.tripId}
              declaredTons={600}
              acceptedTons={598.8}
              toleranceTons={0.5}
              note='Отклонение фиксируется актом расхождения; без него документное основание не передаётся дальше.'
            />
            <KeyFactGrid>
              <KeyFact label='Лаборатория' value={receiving.lab} />
              <KeyFact label='Документы' value={receiving.docs} />
              <KeyFact label='Отклонение' value={receiving.deviation} />
              <KeyFact label='Действие' value={receiving.next} />
            </KeyFactGrid>
          </div>
        </CollapsibleSection>
      </section>

      <section id='quality' className={workspace.sectionAnchor}>
        <CollapsibleSection title='Качество и условия допуска' summary='примесь · акт · протокол' defaultOpen={false}>
          <div className={workspace.sectionStack}>
            <div className={workspace.twoColumn}>
              {gates.map((gate) => (
                <Surface key={`${gate.title}-${gate.value}`} padding='comfortable'>
                  <div className={workspace.sectionStack}>
                    <StatusBadge tone={gate.tone}>{gate.title}</StatusBadge>
                    <strong>{gate.value}</strong>
                    <span className={workspace.muted}>{gate.impact}</span>
                  </div>
                </Surface>
              ))}
            </div>
            <div className={workspace.twoColumn}>
              {quality.map((item) => (
                <Surface key={item.label} padding='comfortable'>
                  <div className={workspace.sectionStack}>
                    <StatusBadge tone={item.state === 'stop' ? 'danger' : 'warning'}>{item.label}</StatusBadge>
                    <strong>{item.value}</strong>
                    <span className={workspace.muted}>{item.limit}</span>
                  </div>
                </Surface>
              ))}
            </div>
            <div className={workspace.alert}>
              При отклонении веса или качества создаётся акт расхождения и задача оператору. Передача документного основания не продолжается до закрытия акта и протокола.
            </div>
          </div>
        </CollapsibleSection>
      </section>

      <CollapsibleSection title='Runtime приёмки' summary='очередь · акт · действие' defaultOpen={false}>
        <FieldElevatorRuntime />
      </CollapsibleSection>
    </div>
  );

  const intakeSummary = (
    <ol className={workspace.contextList}>
      {intakeChecklist.map((item) => (
        <li key={item.label}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          <small>{item.note}</small>
        </li>
      ))}
    </ol>
  );

  const context = (
    <div className={workspace.stack}>
      <StatusBadge tone={pendingSamples.length ? 'warning' : 'success'}>
        {pendingSamples.length ? `${pendingSamples.length} проб ожидают` : 'Пробы закрыты'}
      </StatusBadge>
      <p className={workspace.muted}>
        Роль приёмки видит рейс, партию, вес, пробу, акт и отклонение. Коммерческая цена и банковские операции не раскрываются.
      </p>
    </div>
  );

  const evidence = (
    <div className={workspace.evidenceStack}>
      <Surface padding='comfortable'>
        <div className={workspace.sectionStack}>
          <CauseLine
            cause={{ text: 'Акт расхождения по весу не подписан', tone: 'blocked' }}
            relation='blocks'
            effect={{ text: 'Документное основание не передаётся дальше', tone: 'blocked' }}
          />
          <CauseLine
            cause={{ text: 'Превышение по сорной примеси (2,4% > 2%)', tone: 'warning' }}
            relation='requires'
            effect={{ text: 'Протокол качества', tone: 'warning' }}
          />
          <TrustDot state='test' size='sm' label='Контур исполнения · физические данные требуют реальных приёмок' />
          <SmartSectionSummary
            label='Статус приёмки'
            items={[
              { text: 'TRIP-2403-001 · Вес 598,8 т · Отклонение -1,2 т · Акт готовится', tone: 'warn' },
              { text: 'Сорная примесь 2,4% — выше допуска 2% · Протокол ожидается', tone: 'warn' },
            ]}
          />
        </div>
      </Surface>
      <DecisionRecommendationStrip context='elevator' />
      <EvidenceReadinessMiniMatrix context='elevator' />
      <RoleExecutionHandoff items={elevatorHandoff} title='исполнение: что приёмка отправляет и ожидает' />
    </div>
  );

  return (
    <IntakeWorkbenchTemplate
      testId='platform-v7-elevator-page'
      eyebrow='Элеватор · полевая приёмка'
      title='Очередь, текущий рейс, чек-лист и акт'
      description='Первый уровень показывает физический факт приёмки, блокер и одно действие. Цена сделки и банковские операции скрыты.'
      statusLabel={pendingSamples.length ? 'Приёмка заблокирована' : 'Можно продолжать'}
      statusTone={pendingSamples.length ? 'warning' : 'success'}
      liveStatus={liveStatus}
      intakeSummary={intakeSummary}
      primary={primary}
      context={context}
      evidence={evidence}
    />
  );
}
