import { GrainWorkflowPage } from '../../../../../components/platform-v7/GrainWorkflowPage';

export default function DealAuditPage({ params }: { params: { id: string } }) {
  return <GrainWorkflowPage eyebrow='Сделка · журнал' title={`Журнал сделки ${params.id}`} lead='Журнал показывает действия, роли, объекты, причины, изменения статуса и материалы, на которые опирается сделка.' primaryHref='/platform-v7/data-room/grain' primaryLabel='Data-room' items={[
    { title: 'Партия', value: 'создана', href: '/platform-v7/seller/batches', tone: 'good', note: 'Событие создания партии связано с продавцом.' },
    { title: 'Оффер', value: 'версия сохранена', href: '/platform-v7/offer-log', tone: 'good', note: 'Изменение условий создаёт новую запись.' },
    { title: 'Документ', value: 'открыт', href: '/platform-v7/documents/grain', tone: 'warn', note: 'Просмотр и скачивание фиксируются.' },
    { title: 'Риск', value: 'проверен', href: '/platform-v7/security/grain', tone: 'warn', note: 'Сигналы риска связаны с объектом сделки.' },
  ]} />;
}
