import Link from 'next/link';

const roles=[
  {href:'/platform-v7/seller',tone:'seller',title:'Продавец',text:'Продавайте зерно по прозрачной цене. Контроль оплаты и отгрузки.',meta:['3 мин','Просто','80% пользователей'],points:['Лоты и деньги на одном экране','Сразу видно, что блокирует выпуск']},
  {href:'/platform-v7/buyer',tone:'buyer',title:'Покупатель',text:'Находите поставщиков по фильтрам. Сравнивайте цены и условия.',meta:['5 мин','Средне','Популярно'],points:['Цена, качество и оплата рядом','Сравнение вместо витрины']},
  {href:'/platform-v7/driver',tone:'driver',title:'Водитель',text:'Получайте рейсы, стройте маршрут. Работает без интернета.',meta:['Мгновенно','Просто','Поле'],points:['Один экран — одно действие','Фото, чекпоинт и инцидент без перегруза']},
  {href:'/platform-v7/bank',tone:'bank',title:'Банк',text:'Управляйте резервами и выпуском. Видны удержания и основания.',meta:['5 мин','Верификация','Финконтур'],points:['Release зависит от фактов','Видна причина ручной проверки']},
  {href:'/platform-v7/documents',tone:'docs',title:'Документы',text:'Собирайте пакет сделки и отслеживайте комплектность.',meta:['3 мин','Средне','Обязательный модуль'],points:['Точный процент заполнения','Понятно, какой файл блокирует деньги']},
  {href:'/platform-v7/control',tone:'control',title:'Контроль и спор',text:'Решайте спор онлайн. Доступ к доказательствам и SLA.',meta:['7 мин','Верификация','Риск'],points:['Сумма под риском видна сразу','Есть owner и срок реакции']},
] as const;

export default function Page(){
  return <div className='t7-frame'><div className='t7-stack'>
    <section className='t7-hero'>
      <div className='t7-eyebrow'>Каталог рабочих мест</div>
      <h1 className='t7-h1'>Выберите ваше рабочее место</h1>
      <p className='t7-lead'>После выбора роли открывается не абстрактная страница, а готовый контур задачи: продажа, закупка, рейс, пакет документов, деньги или спор.</p>
      <div className='t7-actions'><Link href='/platform-v7/deal' className='t7-btn'>Открыть центр сделки</Link><span className='t7-chip t7-chip-indigo'>Выбор роли должен занимать меньше 15 секунд</span></div>
    </section>
    <section className='t7-alert'><div className='t7-eyebrow'>Подсказка для первого входа</div><div className='t7-text' style={{marginTop:8}}>Начни с роли продавца, если нужен быстрый обзор денег, лотов и блокеров по документам.</div></section>
    <section className='t7-grid3'>
      {roles.map(role=><Link key={role.href} href={role.href} className='t7-role'>
        <div className='t7-rolehead'><span className={`t7-chip t7-chip-${role.tone}`}>{role.title}</span><span className='t7-chip'>{role.meta[0]}</span></div>
        <div><h2 className='t7-roletitle'>{role.title}</h2><p className='t7-rolesummary'>{role.text}</p></div>
        <ul className='t7-rolebullets'>{role.points.map(p=><li key={p}>{p}</li>)}</ul>
        <div className='t7-actions' style={{marginTop:0}}><span className='t7-chip'>{role.meta[1]}</span><span className='t7-chip'>{role.meta[2]}</span></div>
        <div className='t7-preview'><div className='t7-previewrow'><div><div className='t7-previewtitle'>Preview</div><div className='t7-previewtext'>Ключевой экран роли до клика</div></div><span className={`t7-chip t7-chip-${role.tone}`}>готово</span></div></div>
        <div className='t7-cta'>Открыть рабочее место →</div>
      </Link>)}
    </section>
  </div></div>;
}
