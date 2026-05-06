import { GrainWorkflowPage } from '../../../../../components/platform-v7/GrainWorkflowPage';

export default function DealDisputesPage({ params }: { params: { id: string } }) {
  return <GrainWorkflowPage eyebrow='Сделка · спор' title={`Спорный контур ${params.id}`} lead='Спор открывается на конкретную причину, сумму, материалы, решение и следующий шаг.' primaryHref='/platform-v7/disputes' primaryLabel='Споры' items={[
    { title: 'Причина', value: 'фиксируется', href: '/platform-v7/disputes', tone: 'warn', note: 'Качество, вес, документы, логистика или расчёт.' },
    { title: 'Сумма', value: 'отделена', href: '/platform-v7/settlement/grain', tone: 'warn', note: 'Спорная часть не смешивается со всей суммой.' },
    { title: 'Материалы', value: 'собраны', href: '/platform-v7/data-room/grain', tone: 'good', note: 'Документы, фото, протокол и события.' },
    { title: 'Решение', value: 'с основанием', href: '/platform-v7/arbitrator/grain', tone: 'good', note: 'Закрытие требует причины и журнала.' },
  ]} />;
}
