import Link from 'next/link';

const lots = [
  { id: 'LOT-2403', title: 'Пшеница 4 класса · 600 т · EXW', status: 'предложение принято', money: 'резерв 9,65 млн ₽', next: 'закрыть СДИЗ, ЭТрН и акт приёмки', href: '/platform-v7/lots/LOT-2403' },
  { id: 'LOT-2405', title: 'Пшеница 4 класса · 240 т · EXW', status: 'идут предложения', money: 'ставка 16 120 ₽/т', next: 'проверить покупателя и условия резерва', href: '/platform-v7/lots/LOT-2405' },
] as const;

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className='seller-v2-kpi'><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

export function SellerWorkspaceV2({ dealsCount, disputeCount }: { dealsCount: number; disputeCount: number }) {
  return (
    <div className='seller-workspace-v2' data-seller-workspace-v2='true'>
      <section className='seller-v2-hero'>
        <div>
          <span className='seller-v2-kicker'>Кабинет продавца · документы → деньги</span>
          <h1>Закройте документы для проверки</h1>
          <p>Резерв покупателя виден, но основание для проверки выплаты не сформировано. Следующий шаг — закрыть СДИЗ, ЭТрН и акт приёмки.</p>
          <div className='seller-v2-actions'><Link href='#documents'>Подготовить документы</Link><Link href='/platform-v7/deals/DL-9106/clean' data-secondary='true'>Открыть сделку</Link></div>
        </div>
        <aside className='seller-v2-status'><span>Главный блокер</span><strong>СДИЗ и ЭТрН не закрыты</strong><p>Нет проверяемого основания для расчёта.</p></aside>
      </section>

      <nav className='seller-v2-tabs' aria-label='Быстрый переход по кабинету продавца'><Link href='#documents'>Документы</Link><Link href='#money'>Деньги</Link><Link href='#lots'>Партии</Link><Link href='#journal'>Журнал</Link></nav>

      <section className='seller-v2-kpis'><Kpi label='Сделок в работе' value={String(dealsCount)} note='по текущему контуру' /><Kpi label='Резерв покупателя' value='9,65 млн ₽' note='это не выплата' /><Kpi label='На проверку' value='0 ₽' note='нет закрытого пакета' /><Kpi label='Открытых споров' value={String(disputeCount)} note='по текущему контуру' /></section>

      <section className='seller-v2-panel'><div className='seller-v2-head'><span className='seller-v2-kicker'>Следующие действия</span><h2>Что сделать сейчас</h2><p>Экран показывает ближайший безопасный путь к проверке.</p></div><div className='seller-v2-steps'><article className='seller-v2-step'><b>1</b><strong>Закрыть СДИЗ</strong><p>Подтвердить партию в документном контуре.</p></article><article className='seller-v2-step'><b>2</b><strong>Подписать ЭТрН</strong><p>Связать транспортный документ с рейсом.</p></article><article className='seller-v2-step'><b>3</b><strong>Передать пакет</strong><p>Отправить документы на проверку основания.</p></article></div></section>

      <section id='documents' className='seller-v2-panel'><div className='seller-v2-head'><span className='seller-v2-kicker'>Документы</span><h2>Пакет для проверки</h2><p>СДИЗ, ЭТрН, акт приёмки и протокол качества должны соответствовать событиям сделки.</p></div><div className='seller-v2-steps'><article className='seller-v2-step'><b>!</b><strong>СДИЗ</strong><p>Ожидает закрытия.</p></article><article className='seller-v2-step'><b>!</b><strong>ЭТрН</strong><p>Ожидает подписания.</p></article><article className='seller-v2-step'><b>✓</b><strong>Партия</strong><p>Связана с лотом и сделкой.</p></article></div></section>

      <section id='money' className='seller-v2-panel'><div className='seller-v2-head'><span className='seller-v2-kicker'>Деньги</span><h2>Резерв есть, выплаты нет</h2><p>Платформа показывает основание и статус. Финансовое действие выполняется после закрытия документов и проверки.</p></div><div className='seller-v2-kpis'><Kpi label='Резерв' value='9,65 млн ₽' note='виден в контуре' /><Kpi label='К проверке' value='0 ₽' note='пакет не готов' /></div></section>

      <section id='lots' className='seller-v2-panel'><div className='seller-v2-head'><span className='seller-v2-kicker'>Партии и лоты</span><h2>Что продаётся</h2></div><div className='seller-v2-lots'>{lots.map((lot) => <Link key={lot.id} href={lot.href} className='seller-v2-lot'><span>{lot.id}</span><strong>{lot.title}</strong><p>{lot.status} · {lot.money}</p><small>{lot.next}</small></Link>)}</div></section>

      <section id='journal' className='seller-v2-panel'><div className='seller-v2-head'><span className='seller-v2-kicker'>Журнал</span><h2>Последние события</h2></div><div className='seller-v2-lots'><article className='seller-v2-lot'><span>Сегодня</span><strong>Сделка ожидает документы</strong><p>СДИЗ и ЭТрН не закрыты.</p></article><article className='seller-v2-lot'><span>Вчера</span><strong>Покупатель подтвердил резерв</strong><p>Финансовый шаг ожидает основания.</p></article></div></section>
    </div>
  );
}
