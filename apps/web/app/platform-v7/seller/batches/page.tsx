import { GrainWorkflowPage } from '../../../../components/platform-v7/GrainWorkflowPage';

export default function SellerBatchesPage() {
  return <GrainWorkflowPage eyebrow='Продавец · партии' title='Партии зерна продавца' lead='Продавец начинает не с объявления, а с партии: объём, качество, документы, СДИЗ, готовность и следующий шаг.' primaryHref='/platform-v7/batches' primaryLabel='Все партии' items={[
    { title: 'Готовность партии', value: '72–100%', href: '/platform-v7/batches', tone: 'warn', note: 'Проверка качества, документов, СДИЗ и доступного объёма.' },
    { title: 'Создать партию', value: 'быстрый ввод', href: '/platform-v7/seller/batches/new', tone: 'good', note: 'Культура, класс, объём, место хранения и документы.' },
    { title: 'Создать лот', value: 'из партии', href: '/platform-v7/seller/lots/new', tone: 'good', note: 'Лот создаётся только из подготовленной партии.' },
    { title: 'Подходящие RFQ', value: 'есть совпадения', href: '/platform-v7/seller/rfq', tone: 'good', note: 'Потребности покупателей под партии продавца.' },
  ]} />;
}
