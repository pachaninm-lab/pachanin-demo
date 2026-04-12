import Link from 'next/link';

const steps = [
  ['Цена и допуск', 'Базис, отклонения и готовность сторон подтверждаются до движения денег.'],
  ['Логистика и приёмка', 'Рейс, вес, качество и handoff собираются в единый след.'],
  ['Документы и выпуск', 'Пакет и результат спора напрямую влияют на release.'],
  ['Доказательства', 'События, авторы и время видны на всём пути сделки.'],
] as const;

export default function Page() {
  return <div className='t7-frame'><div className='t7-stack'>
    <section className='t7-hero'>
      <div className='t7-eyebrow'>Control tower сделки</div>
      <h1 className='t7-h1'>Не витрина. Операционная система исполнения зерновой сделки.</h1>
      <p className='t7-lead'>Первый экран объясняет не маркетинг, а механику: где находится партия, что блокирует деньги, какой документ не загружен и кто держит следующий шаг.</p>
      <div className='t7-actions'>
        <Link href='/platform-v7/roles' className='t7-btn primary'>Выбрать рабочее место</Link>
        <Link href='/platform-v7/deal' className='t7-btn'>Открыть cockpit сделки</Link>
        <Link href='/platform-v7/bank' className='t7-btn ghost'>Проверить денежный контур</Link>
      </div>
    </section>

    <section className='t7-grid4'>
      <article className='t7-card'><div className='t7-chip t7-chip-indigo'>Статусы</div><div className='t7-value'>17</div><div className='t7-label'>визуально различимых состояний сделки без выпадающих списков</div></article>
      <article className='t7-card'><div className='t7-chip t7-chip-bank'>Деньги</div><div className='t7-value'>3 873 600 ₽</div><div className='t7-label'>сумма под контролем банка и платёжных условий</div></article>
      <article className='t7-card'><div className='t7-chip t7-chip-docs'>Пакет</div><div className='t7-value'>92%</div><div className='t7-label'>обязательных документов уже собраны</div></article>
      <article className='t7-card'><div className='t7-chip t7-chip-control'>Риск</div><div className='t7-value'>624 000 ₽</div><div className='t7-label'>под удержанием до решения по качеству</div></article>
    </section>

    <section className='t7-panel'>
      <div className='t7-eyebrow'>Сквозной путь сделки</div>
      <div className='t7-grid4' style={{marginTop:16}}>{steps.map(([title,text])=><article key={title} className='t7-card'><h2 className='t7-h2'>{title}</h2><div className='t7-text' style={{marginTop:10}}>{text}</div></article>)}</div>
    </section>

    <section className='t7-grid2'>
      <Link href='/platform-v7/roles' className='t7-role'>
        <div className='t7-rolehead'><span className='t7-chip t7-chip-indigo'>Каталог ролей</span><span className='t7-chip'>главный вход</span></div>
        <div><h2 className='t7-roletitle'>Рабочие места по ролям</h2><p className='t7-rolesummary'>Выбор роли строится как каталог рабочих мест, а не как список карточек без контекста.</p></div>
        <div className='t7-preview'><div className='t7-previewrow'><div><div className='t7-previewtitle'>Продавец</div><div className='t7-previewtext'>лоты, деньги, блокеры</div></div><span className='t7-chip t7-chip-seller'>3 мин</span></div><div className='t7-previewrow'><div><div className='t7-previewtitle'>Водитель</div><div className='t7-previewtext'>рейс, фото, инцидент</div></div><span className='t7-chip t7-chip-driver'>мгновенно</span></div></div>
        <div className='t7-cta'>Открыть каталог →</div>
      </Link>
      <Link href='/platform-v7/deal' className='t7-role'>
        <div className='t7-rolehead'><span className='t7-chip t7-chip-buyer'>Центр сделки</span><span className='t7-chip'>главный объект</span></div>
        <div><h2 className='t7-roletitle'>Cockpit исполнения</h2><p className='t7-rolesummary'>Статус, owner, blocker, следующий шаг и сумма под риском собираются в одном объекте.</p></div>
        <div className='t7-preview'><div className='t7-previewrow'><div><div className='t7-previewtitle'>Приёмка</div><div className='t7-previewtext'>ждём акт</div></div><span className='t7-chip t7-chip-warn'>blocker</span></div><div className='t7-previewrow'><div><div className='t7-previewtitle'>Деньги</div><div className='t7-previewtext'>есть удержание</div></div><span className='t7-chip t7-chip-bank'>release</span></div></div>
        <div className='t7-cta'>Открыть cockpit →</div>
      </Link>
    </section>
  </div></div>;
}
