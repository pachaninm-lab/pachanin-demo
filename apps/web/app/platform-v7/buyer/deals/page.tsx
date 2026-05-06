import { GrainWorkflowPage } from '../../../../components/platform-v7/GrainWorkflowPage';

export default function BuyerDealsPage() {
  return <GrainWorkflowPage eyebrow='Покупатель · сделки' title='Сделки покупателя' lead='Покупатель видит, где требуется действие: резерв, документы, приёмка, качество, удержание, спор и следующий шаг.' primaryHref='/platform-v7/deals' primaryLabel='Все сделки' items={[
    { title: 'DL-9106', value: 'ожидает действие', href: '/platform-v7/deals/DL-9106/clean', tone: 'warn', note: 'Открыть карточку сделки и условия исполнения.' },
    { title: 'Резерв', value: 'требует подтверждения', href: '/platform-v7/bank/grain', tone: 'warn', note: 'Денежный контур связан с условиями сделки.' },
    { title: 'Документы', value: 'на проверке', href: '/platform-v7/documents/grain', tone: 'warn', note: 'Пакет влияет на дальнейшее исполнение.' },
    { title: 'Материалы', value: 'доступ по роли', href: '/platform-v7/data-room/grain', tone: 'good', note: 'Документы и события собраны в один контур.' },
  ]} />;
}
