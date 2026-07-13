import { NextActionCard, StatusChip, Surface } from '@pc/design-system-v8';
import { FieldTaskTemplate, KeyFact, KeyFactGrid } from '@/components/transaction-ux/FieldTaskTemplate';
import workspace from '@/components/transaction-ux/FieldRoleWorkspace.module.css';
import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { FieldLabRuntime } from '@/components/v7r/FieldLabRuntime';
import { RoleContinuityPanel } from '@/components/v7r/RoleContinuityPanel';
import { QuietIntelligenceHint } from '@/components/platform-v7/visual/QuietIntelligenceHint';
import { TrustDot } from '@/components/platform-v7/visual/TrustDot';
import { LiveApiStatusBar } from '@/components/platform-v7/LiveApiStatusBar';
import { getLabSamples, pendingProtocols, labMoneyImpactRub } from '@/lib/labs-server';
import { CauseLine } from '@/components/platform-v7/visual/CauseLine';
import { QualityDeltaBars } from '@/components/platform-v7/QualityDeltaBars';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { GostQualityForm } from '@/components/platform-v7/GostQualityForm';
import { LabPhotoUpload } from '@/components/platform-v7/LabPhotoUpload';

const labSteps = [
  { label: 'Проба', value: 'отбор и фиксация', note: 'кто взял, когда, по какому рейсу' },
  { label: 'Показатели', value: 'влага, сорность, клейковина', note: 'цифры видны без лишнего текста' },
  { label: 'Отклонение', value: 'сорная примесь 2,4%', note: 'допуск до 2% — нужен протокол' },
  { label: 'Протокол', value: 'ожидает решения', note: 'допуск или отказ уходит в документы' },
] as const;

export default async function Page() {
  const samples = await getLabSamples();
  const pending = pendingProtocols(samples);
  const moneyImpact = labMoneyImpactRub(samples);
  const apiOnline = samples.some((sample) => !sample.id.startsWith('SAMPLE-00'));
  const impactLabel = moneyImpact !== 0
    ? `${(moneyImpact / 1_000_000).toFixed(2)} млн ₽`
    : 'нет денежного влияния';

  const liveBlockers = pending.map((sample) => ({
    id: sample.id,
    label: `Проба ${sample.id}: ${sample.status} · ${sample.culture ?? 'культура не указана'}`,
    severity: 'warn' as const,
    responsibleRole: 'LAB',
    nextAction: 'Провести анализ и финализировать протокол',
  }));

  const liveStatus = (
    <LiveApiStatusBar
      apiOnline={apiOnline}
      blockers={liveBlockers}
      role='LAB · Лабораторный контур'
      summary={apiOnline
        ? `${samples.length} проб · ${pending.length} ожидают финализации · ${impactLabel} влияние`
        : 'Данные статичные — API недоступен'}
    />
  );

  const primary = (
    <div className={workspace.stack}>
      <NextActionCard
        label='Одно следующее действие'
        action='Финализировать протокол качества'
        reason='Сорная примесь 2,4% превышает допуск 2%. Нужно зафиксировать показатели и выдать протокол с допуском либо отказом.'
        blocked={pending.length > 0}
        impact={impactLabel}
        owner='лаборатория'
        deadline='до закрытия пакета качества'
        actions={(
          <>
            <a className={workspace.primaryLink} href='#quality-protocol'>Открыть протокол</a>
            <a className={workspace.secondaryLink} href='#quality-evidence'>Проверить доказательства</a>
          </>
        )}
      />

      <KeyFactGrid>
        <KeyFact label='Проб' value={samples.length} hint='доступно роли лаборатории' />
        <KeyFact label='Ожидают решения' value={pending.length} hint='требуют финализации' />
        <KeyFact label='Критическое отклонение' value='2,4% сорной примеси' hint='допуск до 2%' />
        <KeyFact label='Результат' value='протокол качества' hint='передаётся в документы' />
      </KeyFactGrid>

      <QuietIntelligenceHint
        problem='Сорная примесь 2,4% превышает допуск 2% — протокол качества не закрыт.'
        action='Зафиксировать показатели и выдать протокол с допуском или отказом.'
        outcome='Протокол уйдёт в контур документов как основание для дальнейшей проверки.'
      />

      <section id='quality-protocol' className={workspace.sectionAnchor}>
        <CollapsibleSection title='Протокол качества по ГОСТ' summary='ГОСТ 9353 · показатели · допуск' defaultOpen>
          <GostQualityForm defaultCulture='wheat_4' sampleId='SAMPLE-0042' compact={false} />
        </CollapsibleSection>
      </section>

      <CollapsibleSection title='Показатели качества' summary='влага · клейковина · сорность' defaultOpen>
        <QualityDeltaBars
          title='Протокол качества · показатели против допуска'
          indicators={[
            { label: 'Влажность', value: 13.1, unit: '%', max: 14, limitLabel: 'допуск до 14%' },
            { label: 'Клейковина', value: 23, unit: '%', min: 21, limitLabel: 'минимум 21%' },
            { label: 'Сорная примесь', value: 2.4, unit: '%', max: 2, limitLabel: 'допуск до 2% — превышение требует протокола с допуском или отказом' },
          ]}
        />
      </CollapsibleSection>

      <CollapsibleSection title='Фото и сканы пробы' summary='загрузка JPG · PNG · PDF · TIFF' defaultOpen={false}>
        <LabPhotoUpload sampleId='SAMPLE-0042' />
      </CollapsibleSection>

      <CollapsibleSection title='Лабораторный runtime' summary='пробы · протокол · действие' defaultOpen={false}>
        <FieldLabRuntime />
      </CollapsibleSection>
    </div>
  );

  const context = (
    <div className={workspace.stack}>
      <StatusChip tone={pending.length ? 'warning' : 'success'}>
        {pending.length ? `${pending.length} протокола ожидают` : 'Очередь закрыта'}
      </StatusChip>
      <ol className={workspace.contextList}>
        {labSteps.map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.note}</small>
          </li>
        ))}
      </ol>
    </div>
  );

  const evidence = (
    <section id='quality-evidence' className={`${workspace.evidenceStack} ${workspace.sectionAnchor}`}>
      <Surface>
        <div className={workspace.sectionStack}>
          <CauseLine
            cause={{ text: 'Протокол качества не выдан', tone: 'blocked' }}
            relation='blocks'
            effect={{ text: 'Пакет документов по качеству не закрыт', tone: 'blocked' }}
          />
          <TrustDot state='test' size='sm' label='Тестовый контур · внешнее подтверждение требуется отдельно' />
        </div>
      </Surface>
      <CollapsibleSection title='Роль и передача результата' summary='ответственный · непрерывность' defaultOpen={false}>
        <div className={workspace.sectionStack}>
          <RoleExecutionSummary role='lab' />
          <RoleContinuityPanel role='lab' compact />
        </div>
      </CollapsibleSection>
    </section>
  );

  return (
    <FieldTaskTemplate
      testId='platform-v7-lab-page'
      eyebrow='Лаборатория · полевая роль'
      title='Проба, показатели и протокол качества'
      description='На первом уровне только отклонение, требуемое решение и результат для сделки. Финансовое решение, спор и банковская проверка остаются вне роли лаборатории.'
      statusLabel={apiOnline ? 'API доступен' : 'Статичный контур'}
      statusTone={apiOnline ? 'success' : 'warning'}
      liveStatus={liveStatus}
      primary={primary}
      context={context}
      evidence={evidence}
    />
  );
}
