import { GrainWorkflowPage } from '../../../../../components/platform-v7/GrainWorkflowPage';

export default function SellerNewBatchPage() {
  return <GrainWorkflowPage eyebrow='Продавец · новая партия' title='Создание партии зерна' lead='Черновик партии создаётся даже если часть данных неизвестна. Неизвестное становится задачей, а не ошибкой пользователя.' primaryHref='/platform-v7/seller/quick-sale' primaryLabel='Быстрая продажа' items={[
    { title: 'Что продаётся', value: 'культура / класс / объём', href: '/platform-v7/seller/quick-sale', tone: 'good' },
    { title: 'Где лежит', value: 'регион без лишнего раскрытия', href: '/platform-v7/seller/batches', tone: 'warn' },
    { title: 'Что готово', value: 'качество / документы / СДИЗ', href: '/platform-v7/documents/grain', tone: 'warn' },
    { title: 'Следующий шаг', value: 'лот или RFQ', href: '/platform-v7/seller/lots/new', tone: 'good' },
  ]} />;
}
