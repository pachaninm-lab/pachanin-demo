import { GrainWorkflowPage } from '../../../../components/platform-v7/GrainWorkflowPage';

export default function SellerRfqPage() {
  return <GrainWorkflowPage eyebrow='Продавец · запросы покупателей' title='RFQ покупателей под партии продавца' lead='Продавец видит закупочные запросы, которые совпадают с его партиями по культуре, классу, объёму, региону, документам, логистике и риску.' primaryHref='/platform-v7/buyer/rfq' primaryLabel='RFQ' items={[
    { title: 'Сильное совпадение', value: '85%+', href: '/platform-v7/seller/matches', tone: 'good', note: 'Можно предложить партию покупателю.' },
    { title: 'Нужно уточнить', value: 'условия', href: '/platform-v7/support/grain', tone: 'warn', note: 'Не хватает качества, документов или окна поставки.' },
    { title: 'Оффер продавца', value: 'создать', href: '/platform-v7/seller/offers', tone: 'good', note: 'Ответ на закупочный запрос через структурированный оффер.' },
    { title: 'DealDraft', value: 'после принятия', href: '/platform-v7/deal-drafts/DD-OFFER-1', tone: 'good', note: 'Принятые условия переводятся в управляемую сделку.' },
  ]} />;
}
