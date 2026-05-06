import { GrainWorkflowPage } from '../../../../../components/platform-v7/GrainWorkflowPage';

export default function DealLogisticsPage({ params }: { params: { id: string } }) {
  return <GrainWorkflowPage eyebrow='Сделка · логистика' title={`Логистика ${params.id}`} lead='Маршрут, перевозчик, водитель, документы рейса, окно погрузки, окно разгрузки, события и следующий шаг.' primaryHref='/platform-v7/logistics/grain' primaryLabel='Логистика' items={[
    { title: 'Заявка', value: 'создана', href: '/platform-v7/logistics/inbox', tone: 'good', note: 'Связана со сделкой и партией.' },
    { title: 'Рейс', value: 'назначается', href: '/platform-v7/driver/grain', tone: 'warn', note: 'Водитель видит только полевые действия.' },
    { title: 'Документы рейса', value: 'на проверке', href: '/platform-v7/documents/grain', tone: 'warn', note: 'Транспортный пакет влияет на закрытие.' },
    { title: 'Инциденты', value: 'контроль', href: '/platform-v7/support/grain', tone: 'warn', note: 'События попадают в поддержку и материалы.' },
  ]} />;
}
