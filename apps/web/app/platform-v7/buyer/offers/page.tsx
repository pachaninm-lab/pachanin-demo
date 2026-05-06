import { GrainWorkflowPage } from '../../../../components/platform-v7/GrainWorkflowPage';

export default function BuyerOffersPage() {
  return <GrainWorkflowPage eyebrow='Покупатель · предложения' title='Предложения покупателя' lead='Покупатель видит свои предложения, статусы, новые версии условий, срок действия и переход к черновику сделки после принятия.' primaryHref='/platform-v7/buyer/lots' primaryLabel='Найти лот' items={[
    { title: 'Предложение', value: 'создано', href: '/platform-v7/offer-log', tone: 'warn', note: 'Ожидает ответа второй стороны.' },
    { title: 'Новая версия', value: 'условия обновлены', href: '/platform-v7/offer-log', tone: 'warn', note: 'Изменения сохраняются как новая версия.' },
    { title: 'Принятие', value: 'черновик сделки', href: '/platform-v7/deal-drafts/DD-OFFER-1', tone: 'good', note: 'Принятые условия переходят в сделку.' },
    { title: 'Журнал', value: 'события есть', href: '/platform-v7/data-room/grain', tone: 'good', note: 'Действия сохраняются в материалах сделки.' },
  ]} />;
}
