import { GrainWorkflowPage } from '../../../../components/platform-v7/GrainWorkflowPage';

export default function BuyerLotsPage() {
  return <GrainWorkflowPage eyebrow='Покупатель · лоты' title='Доступные лоты покупателя' lead='Покупатель видит управляемые рыночные лоты: цену, объём, регион, качество, документы, рейтинг продавца и цену до своей точки.' primaryHref='/platform-v7/lots' primaryLabel='Все лоты' items={[
    { title: 'Рыночные лоты', value: 'доступны', href: '/platform-v7/lots', tone: 'good', note: 'Показаны только допустимые данные по роли.' },
    { title: 'Цена до точки', value: 'рассчитана', href: '/platform-v7/settlement/grain', tone: 'good', note: 'Цена продавца плюс логистика, приёмка, документы и риск.' },
    { title: 'Рейтинг продавца', value: 'учитывается', href: '/platform-v7/buyer/reputation', tone: 'warn', note: 'Влияет на допуск, порядок показа и ручную проверку.' },
    { title: 'Предложение', value: 'создать', href: '/platform-v7/buyer/offers', tone: 'good', note: 'Предложение ведёт к черновику сделки после принятия.' },
  ]} />;
}
