import { GrainWorkflowPage } from '../../../../components/platform-v7/GrainWorkflowPage';

export default function SellerLotsPage() {
  return <GrainWorkflowPage eyebrow='Продавец · лоты' title='Лоты продавца в рынке' lead='Лот создаётся из партии и ведёт к офферу, DealDraft и управляемой сделке. Экран показывает режим публикации, офферы, чистую цену и следующий шаг.' primaryHref='/platform-v7/lots' primaryLabel='Все лоты' items={[
    { title: 'Активные лоты', value: 'в рынке', href: '/platform-v7/lots', tone: 'good', note: 'Рыночная карточка лота и статус предложений.' },
    { title: 'Новый лот', value: 'из партии', href: '/platform-v7/seller/lots/new', tone: 'good', note: 'Публикация только после проверки партии.' },
    { title: 'Офферы', value: 'сравнить', href: '/platform-v7/seller/offers', tone: 'warn', note: 'Цена, условия, рейтинг и чистая цена.' },
    { title: 'Сделки', value: 'после принятия', href: '/platform-v7/seller/deals', tone: 'good', note: 'Принятие ведёт к DealDraft.' },
  ]} />;
}
