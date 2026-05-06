import { GrainWorkflowPage } from '../../../../components/platform-v7/GrainWorkflowPage';

export default function SellerMatchesPage() {
  return <GrainWorkflowPage eyebrow='Продавец · подбор' title='Подходящие покупатели и запросы' lead='Подбор показывает, какие покупатели и закупочные запросы подходят под партии продавца с учётом цены, качества, документов, логистики и риска.' primaryHref='/platform-v7/seller/rfq' primaryLabel='Запросы покупателей' items={[
    { title: 'Лучшее совпадение', value: '92%', href: '/platform-v7/seller/offers', tone: 'good', note: 'Можно отправить предложение по партии.' },
    { title: 'Чистая цена', value: 'рассчитана', href: '/platform-v7/settlement/grain', tone: 'good', note: 'Цена после расходов, удержаний и срока оплаты.' },
    { title: 'Риск покупателя', value: 'стандартный', href: '/platform-v7/seller/reputation', tone: 'warn', note: 'Рейтинг влияет на приоритет и условия.' },
    { title: 'Документы', value: 'на проверке', href: '/platform-v7/documents/grain', tone: 'warn', note: 'Не всё готово для исполнения.' },
  ]} />;
}
