import { GrainWorkflowPage } from '../../../../components/platform-v7/GrainWorkflowPage';

export default function BuyerMatchesPage() {
  return <GrainWorkflowPage eyebrow='Покупатель · подбор' title='Подходящие партии и лоты' lead='Подбор показывает партии и лоты, которые подходят под закупочный запрос покупателя по качеству, объёму, региону, документам, цене и риску.' primaryHref='/platform-v7/buyer/rfq' primaryLabel='Мои RFQ' items={[
    { title: 'Лучший вариант', value: '88%', href: '/platform-v7/buyer/lots', tone: 'good', note: 'Подходит под запрос и условия поставки.' },
    { title: 'Цена до точки', value: 'рассчитана', href: '/platform-v7/settlement/grain', tone: 'good', note: 'Итоговая цена с логистикой и приёмкой.' },
    { title: 'Документы', value: 'на проверке', href: '/platform-v7/documents/grain', tone: 'warn', note: 'Пакет влияет на дальнейшее исполнение.' },
    { title: 'Оффер', value: 'отправить', href: '/platform-v7/buyer/offers', tone: 'good', note: 'Структурированное предложение продавцу.' },
  ]} />;
}
