import Link from 'next/link';

const roles=[
  {href:'/platform-v6/seller',tone:'seller',title:'Продавец',text:'Продавайте зерно по прозрачной цене. Контроль оплаты и отгрузки.',meta:['3 мин','Просто','80% пользователей'],points:['Лоты и деньги на одном экране','Сразу видно, что блокирует выпуск']},
  {href:'/platform-v6/buyer',tone:'buyer',title:'Покупатель',text:'Находите поставщиков по фильтрам. Сравнивайте цены и условия.',meta:['5 мин','Средне','Популярно'],points:['Цена, качество и оплата рядом','Shortlist без витринного шума']},
  {href:'/platform-v6/driver',tone:'driver',title:'Водитель',text:'Получайте рейсы, стройте маршрут. Работает без интернета.',meta:['Мгновенно','Просто','Поле'],points:['Один экран — одно действие','Фото, чекпоинт и инцидент без перегруза']},
  {href:'/platform-v6/bank',tone:'bank',title:'Банк',text:'Управляйте резервами и выпуском. Видны удержания и основания.',meta:['5 мин','Верификация','Финконтур'],points:['Release зависит от фактов','Понятна история ручных проверок']},
  {href:'/platform-v6/documents',tone:'docs',title:'Документы',text:'Собирайте пакет сделки и отслеживайте комплектность.',meta:['3 мин','Средне','Обязательный модуль'],points:['Точный процент заполнения','Понятно, какой файл блокирует деньги']},
  {href:'/platform-v6/control',tone:'control',title:'Контроль и спор',text:'Решайте спор онлайн. Доступ к доказательствам и SLA.',meta:['7 мин','Верификация','Риск'],points:['Сумма под риском видна сразу','Есть owner и срок реакции']},
] as const;

export default function Page(){
  return <div className='tp-frame'><div className='tp-stack'>
    <section className='tp-hero'>
      <div className='tp-eyebrow'>Каталог рабочих мест</div>
      <h1 className='tp-h1'>Выберите ваше рабочее место</h1>
      <p className='tp-lead'>После выбора роли открывается готовый контур задачи: продажа, закупка, рейс, документы, деньги или спор.</p>
      <div className='tp-actions'><Link href='/platform-v6/deal' className='tp-btn'>Открыть центр сделки</Link><span className='tp-chip tp-chip-indigo'>Выбор роли должен занимать меньше 15 секунд</span></div>
    </section>
    <section className='tp-alert'><div className='tp-alert-title'>Подсказка для первого входа</div><div className='tp-alert-text'>Начни с роли продавца, если нужен быстрый обзор денег, лотов и блокеров по документам.</div></section>
    <section className='tp-grid-3'>
      {roles.map(role=><Link key={role.href} href={role.href} className='tp-role-card'>
        <div className='tp-role-head'><span className={`tp-chip tp-chip-${role.tone}`}>{role.title}</span><span className='tp-chip'>{role.meta[0]}</span></div>
        <div><h2 className='tp-role-title'>{role.title}</h2><p className='tp-role-summary'>{role.text}</p></div>
        <ul className='tp-role-bullets'>{role.points.map(p=><li key={p}>{p}</li>)}</ul>
        <div className='tp-actions' style={{marginTop:0}}><span className='tp-chip'>{role.meta[1]}</span><span className='tp-chip'>{role.meta[2]}</span></div>
        <div className='tp-role-preview'><div className='tp-preview-row'><div><div className='tp-preview-title'>Preview</div><div className='tp-preview-text'>Ключевой экран роли до клика</div></div><div className={`tp-chip tp-chip-${role.tone}`}>готово</div></div></div>
        <div className='tp-cta'>Открыть рабочее место →</div>
      </Link>)}
    </section>
  </div></div>
}
