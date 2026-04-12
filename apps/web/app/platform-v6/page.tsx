import Link from 'next/link';

export default function Page(){
  return <div className='tp-frame'><div className='tp-stack'>
    <section className='tp-hero'>
      <div className='tp-eyebrow'>Control tower сделки</div>
      <h1 className='tp-h1'>Не витрина. Центр исполнения сделки.</h1>
      <p className='tp-lead'>Статус, документы, деньги и доказательства должны быть видны сразу.</p>
      <div className='tp-actions'>
        <Link href='/platform-v6/roles' className='tp-btn primary'>Выбрать рабочее место</Link>
        <Link href='/platform-v6/deal' className='tp-btn'>Открыть центр сделки</Link>
      </div>
    </section>
    <section className='tp-grid-3'>
      <article className='tp-card' style={{padding:18}}><div className='tp-chip tp-chip-indigo'>Статусы</div><div className='tp-stat-value'>17</div><div className='tp-stat-label'>визуально различимых состояний сделки</div></article>
      <article className='tp-card' style={{padding:18}}><div className='tp-chip tp-chip-bank'>Деньги</div><div className='tp-stat-value'>3 873 600 ₽</div><div className='tp-stat-label'>сумма под контролем</div></article>
      <article className='tp-card' style={{padding:18}}><div className='tp-chip tp-chip-docs'>Документы</div><div className='tp-stat-value'>92%</div><div className='tp-stat-label'>комплект активной сделки</div></article>
    </section>
  </div></div>
}
