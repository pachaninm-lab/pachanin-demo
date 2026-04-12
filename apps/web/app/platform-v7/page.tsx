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
      <p className='t7-lead'>Первый экран объясняет механику: где находится партия, что блокирует деньги, какой документ не загружен и кто держит следующий шаг.</p>
      <div className='t7-actions'>
        <Link href='/platform-v7/roles' className='t7-btn primary'>Выбрать рабочее место</Link>
        <Link href='/platform-v7/deal' className='t7-btn'>Открыть cockpit сделки</Link>
        <Link href='/platform-v7/bank' className='t7-btn ghost'>Проверить денежный контур</Link>
      </div>
    </section>
    <section className='t7-grid4'>
      <article className='t7-card'><div className='t7-chip t7-chip-indigo'>Статусы</div><div className='t7-value'>17</div><div className='t7-label'>визуально различимых состояний сделки</div></article>
      <article className='t7-card'><div className='t7-chip t7-chip-bank'>Деньги</div><div className='t7-value'>3 873 600 ₽</div><div className='t7-label'>сумма под контролем банка и условий</div></article>
      <article className='t7-card'><div className='t7-chip t7-chip-docs'>Пакет</div><div className='t7-value'>92%</div><div className='t7-label'>обязательных документов уже собраны</div></article>
      <article className='t7-card'><div className='t7-chip t7-chip-control'>Риск</div><div className='t7-value'>624 000 ₽</div><div className='t7-label'>под удержанием до решения по качеству</div></article>
    </section>
    <section className='t7-panel'><div className='t7-eyebrow'>Сквозной путь сделки</div><div className='t7-grid4' style={{marginTop:16}}>{steps.map(([title,text])=><article key={title} className='t7-card'><h2 className='t7-h2'>{title}</h2><div className='t7-text' style={{marginTop:10}}>{text}</div></article>)}</div></section>
  </div></div>;
}
