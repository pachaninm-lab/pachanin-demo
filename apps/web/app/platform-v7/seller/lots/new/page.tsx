import { GrainWorkflowPage } from '../../../../../components/platform-v7/GrainWorkflowPage';

export default function SellerNewLotPage() {
  return <GrainWorkflowPage eyebrow='Продавец · новый лот' title='Создать лот из партии' lead='Лот создаётся только как продолжение партии зерна: с объёмом, базисом, качеством, документами, СДИЗ, видимостью и режимом офферов.' primaryHref='/platform-v7/seller/batches' primaryLabel='Выбрать партию' items={[
    { title: 'Партия', value: 'обязательна', href: '/platform-v7/seller/batches', tone: 'good', note: 'Без партии лот не публикуется.' },
    { title: 'Готовность', value: 'проверяется', href: '/platform-v7/readiness/grain', tone: 'warn', note: 'Качество, документы, СДИЗ и доступный объём.' },
    { title: 'Видимость', value: 'по правилам', href: '/platform-v7/anti-bypass/grain', tone: 'warn', note: 'Покупатели видят только допустимый набор данных.' },
    { title: 'Публикация', value: 'MarketLot', href: '/platform-v7/lots', tone: 'good', note: 'После публикации лот попадает в подбор и офферы.' },
  ]} />;
}
