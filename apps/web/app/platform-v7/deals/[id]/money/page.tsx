import { GrainWorkflowPage } from '../../../../../components/platform-v7/GrainWorkflowPage';

export default function DealMoneyPage({ params }: { params: { id: string } }) {
  return <GrainWorkflowPage eyebrow='Сделка · расчёт' title={`Расчёт ${params.id}`} lead='Сводка суммы, резерва, удержаний, статуса и следующего шага по сделке.' primaryHref='/platform-v7/settlement/grain' primaryLabel='Расчёт' items={[
    { title: 'Резерв', value: 'на проверке', href: '/platform-v7/bank/grain', tone: 'warn', note: 'Связан с условиями сделки.' },
    { title: 'Сумма', value: 'рассчитана', href: '/platform-v7/settlement/grain', tone: 'good', note: 'Расчёт строится по факту исполнения.' },
    { title: 'Материалы', value: 'есть', href: '/platform-v7/data-room/grain', tone: 'good', note: 'Основания доступны в карточке материалов.' },
    { title: 'Следующий шаг', value: 'оператор', href: '/platform-v7/operator/grain', tone: 'warn', note: 'Ответственный виден в очереди.' },
  ]} />;
}
