import Link from 'next/link';
import { RoleExecutionSummary } from '@/components/platform-v7/RoleExecutionSummary';
import { BankCompliancePilotPanel } from '@/components/platform-v7/BankCompliancePilotPanel';
import { ComplianceRuntime } from '@/components/v7r/ComplianceRuntime';
import { RoleExecutionCockpitContent } from '@/components/platform-v7/RoleExecutionCockpit';
import { PRIMARY_ROLE_EXECUTION_COCKPITS } from '@/lib/platform-v7/role-execution-cockpit';
import { CollapsibleSection } from '@/components/platform-v7/CollapsibleSection';
import { KycQueuePanel } from '@/components/platform-v7/KycQueuePanel';
import { FraudDetectorPanel } from '@/components/platform-v7/FraudDetectorPanel';
import { RosselhoznadzorPanel } from '@/components/platform-v7/RosselhoznadzorPanel';
import { OpaAbacPanel } from '@/components/platform-v7/OpaAbacPanel';
import { SecurityAttackPanel } from '@/components/platform-v7/SecurityAttackPanel';
import {
  OperationalCockpitSection,
  OperationalDecisionCockpit,
  operationalCockpitClasses,
} from '@/components/transaction-ux/OperationalDecisionCockpit';

export default function CompliancePage() {
  return (
    <OperationalDecisionCockpit
      testId='platform-v7-compliance-v8'
      eyebrow='Комплаенс · допуск → риск → решение'
      title='Проверить стоп-фактор до движения Сделки'
      description='Комплаенс работает не с общей витриной, а с конкретным допуском: контрагент, документы, источник риска, основание решения и журнал.'
      statusLabel='ручной допуск'
      statusTone='warning'
      priority={{
        state: 'critical',
        title: 'Принять решение по контрагенту с неполным пакетом',
        description: 'Сделка не должна перейти к аукциону или исполнению, пока обязательные сведения и риск-факторы не проверены человеком с соответствующей ролью.',
        blocker: '2 документа не подтверждены + 1 стоп-фактор',
        owner: 'комплаенс-офицер',
        impact: 'допуск Сделки остановлен',
        result: 'разрешить, отклонить или запросить уточнение с основанием',
        primaryAction: <Link className={operationalCockpitClasses.primaryLink} href='#admission'>Открыть очередь допуска</Link>,
        secondaryAction: <Link className={operationalCockpitClasses.secondaryLink} href='#checks'>Проверки и источники</Link>,
      }}
      facts={[
        { label: 'Контрагентов на проверке', value: '2', hint: 'очередь ручного допуска' },
        { label: 'Документы', value: '6 из 8', hint: 'подтверждены по текущему сценарию' },
        { label: 'Стоп-факторов', value: '1', hint: 'требует объяснимого решения' },
        { label: 'Режим', value: 'human-in-the-loop', hint: 'ИИ и правила не заменяют уполномоченное решение' },
      ]}
      boundary='Комплаенс принимает решение о допуске и фиксирует основание. Он не меняет роли через клиент, не выпускает деньги и не подменяет банк или арбитра.'
    >
      <OperationalCockpitSection id='admission'>
        <RoleExecutionCockpitContent cockpit={PRIMARY_ROLE_EXECUTION_COCKPITS.compliance} />
        <RoleExecutionSummary role='compliance' />
        <BankCompliancePilotPanel mode='compliance' />
      </OperationalCockpitSection>

      <CollapsibleSection title='Очередь KYC / AML' summary='организации · санкции · периодические проверки' defaultOpen={false}>
        <KycQueuePanel />
      </CollapsibleSection>

      <CollapsibleSection title='Антифрод и обход платформы' summary='несоответствия · злоупотребления · эскалация' defaultOpen={false}>
        <FraudDetectorPanel />
      </CollapsibleSection>

      <OperationalCockpitSection id='checks'>
        <div className={operationalCockpitClasses.toolGrid}>
          <CollapsibleSection title='Комплаенс runtime' summary='политики · документы · контроль' defaultOpen={false}>
            <ComplianceRuntime />
          </CollapsibleSection>
          <CollapsibleSection title='Россельхознадзор' summary='фитосанитарные документы · качество' defaultOpen={false}>
            <RosselhoznadzorPanel />
          </CollapsibleSection>
          <CollapsibleSection title='OPA / ABAC' summary='серверные политики доступа · audit' defaultOpen={false}>
            <OpaAbacPanel />
          </CollapsibleSection>
          <CollapsibleSection title='Защита от атак' summary='WAF · rate limit · SAST · secrets' defaultOpen={false}>
            <SecurityAttackPanel />
          </CollapsibleSection>
        </div>
      </OperationalCockpitSection>
    </OperationalDecisionCockpit>
  );
}
