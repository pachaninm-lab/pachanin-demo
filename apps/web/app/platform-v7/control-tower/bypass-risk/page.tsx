import { GrainWorkflowPage } from '../../../../components/platform-v7/GrainWorkflowPage';

export default function ControlTowerBypassRiskPage() {
  return <GrainWorkflowPage eyebrow='Центр управления · риск обхода' title='Профили риска и ограничения' lead='Экран показывает профили риска, сигналы, ограничения, ручную проверку и влияние на доступ к документам, контактам и быстрым сценариям сделки.' primaryHref='/platform-v7/control-tower/anti-bypass' primaryLabel='Очередь сигналов' items={[
    { title: 'Профиль риска', value: 'high', href: '/platform-v7/anti-bypass/grain', tone: 'bad', note: 'Сигналы влияют на доверие и ограничения.' },
    { title: 'Zero direct mode', value: 'включён', href: '/platform-v7/security/grain', tone: 'warn', note: 'Связь и документы идут через этапы сделки.' },
    { title: 'Материалы', value: 'preview', href: '/platform-v7/data-room/grain', tone: 'warn', note: 'Документы открываются по роли и основанию.' },
    { title: 'Комплаенс', value: 'ручная проверка', href: '/platform-v7/compliance/grain', tone: 'warn', note: 'Решение оператора фиксируется в журнале.' },
  ]} />;
}
