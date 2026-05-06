import { GrainWorkflowPage } from '../../../../../components/platform-v7/GrainWorkflowPage';

export default function DealQualityPage({ params }: { params: { id: string } }) {
  return <GrainWorkflowPage eyebrow='Сделка · качество' title={`Качество ${params.id}`} lead='Показатели качества, протокол, отклонения, удержания, повторная проверка и материалы сделки.' primaryHref='/platform-v7/deals/grain-quality' primaryLabel='Качество' items={[
    { title: 'Протокол', value: 'ожидается', href: '/platform-v7/lab/grain', tone: 'warn', note: 'Лаборатория добавляет показатели.' },
    { title: 'Дельта качества', value: 'рассчитывается', href: '/platform-v7/deals/grain-quality', tone: 'warn', note: 'Фактические показатели сравниваются с условиями.' },
    { title: 'Сумма', value: 'пересчёт', href: '/platform-v7/settlement/grain', tone: 'warn', note: 'Качество влияет на итоговый расчёт.' },
    { title: 'Материалы', value: 'цепочка пробы', href: '/platform-v7/data-room/grain', tone: 'good', note: 'Проба, фото и протокол связаны со сделкой.' },
  ]} />;
}
