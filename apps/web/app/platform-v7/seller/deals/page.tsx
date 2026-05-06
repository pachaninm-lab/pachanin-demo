import { GrainWorkflowPage } from '../../../../components/platform-v7/GrainWorkflowPage';

export default function SellerDealsPage() {
  return <GrainWorkflowPage eyebrow='Продавец · сделки' title='Сделки продавца' lead='Сделка показывает условия, документы, расчёт, логистику, качество, материалы и следующий шаг продавца.' primaryHref='/platform-v7/deals' primaryLabel='Все сделки' items={[
    { title: 'DL-9106', value: 'на проверке', href: '/platform-v7/deals/DL-9106/clean', tone: 'warn', note: 'Открыть карточку сделки и условия исполнения.' },
    { title: 'Расчёт', value: 'условия не закрыты', href: '/platform-v7/settlement/grain', tone: 'warn', note: 'Проверить сумму, удержания и основания.' },
    { title: 'Поддержка', value: 'в работе', href: '/platform-v7/support/grain', tone: 'warn', note: 'Обращение связано с объектами сделки.' },
    { title: 'Материалы', value: 'собраны', href: '/platform-v7/data-room/grain', tone: 'good', note: 'Документы и доказательства доступны по роли.' },
  ]} />;
}
