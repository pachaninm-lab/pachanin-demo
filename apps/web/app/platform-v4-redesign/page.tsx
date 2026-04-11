'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const crops=[['Пшеница','15 200 ₽/т','▲ 2.4%','CPT Тамбов'],['Кукуруза','13 100 ₽/т','▼ 1.1%','EXW элеватор'],['Соя','36 200 ₽/т','▲ 1.8%','FOB склад']] as const;
const stats=[['Активных офферов',128,''],['Объем в торгах',24500,' т'],['Успешных сделок',864,'']] as const;

export default function Page(){
  const [values,setValues]=useState([0,0,0]);
  useEffect(()=>{const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;if(reduce){setValues(stats.map((s)=>s[1]));return;}let f=0;const t=performance.now();const step=(n:number)=>{const p=Math.min((n-t)/900,1);setValues(stats.map((s)=>Math.round(s[1]*p)));if(p<1)f=requestAnimationFrame(step)};f=requestAnimationFrame(step);return()=>cancelAnimationFrame(f)},[]);
  return <div className='pv4r'>
    <header className='top'>
      <div><b>Прозрачная Цена</b><span>Preview route: trust-first redesign</span></div>
      <nav><Link href='/platform-v4'>Текущий /platform-v4</Link><Link href='/platform-v4/deal'>Сделки</Link></nav>
    </header>
    <main className='wrap'>
      <section className='hero card'>
        <small>ПРОЗРАЧНАЯ ЦЕНА</small>
        <h1>Здесь продают и покупают зерно безопасно</h1>
        <p>Первый экран перестроен под 3-секундное понимание: цены по культурам, вход по роли, доверие к инфраструктуре и живые показатели сделки.</p>
        <div className='ticker'>{crops.map(([n,p,d,b])=><article key={n} className='card mini'><b>{n}</b><span>{p} · {b}</span><em className={d.startsWith('▲')?'ok':'bad'}>{d}</em></article>)}</div>
        <div className='roles'>
          <Link href='/platform-v4/seller' className='card role green' aria-label='Открыть сценарий производителя и продать зерно'><h2>Я производитель</h2><p>Продажа зерна через понятную цену и прозрачное ожидание денег.</p><strong>Продать зерно</strong></Link>
          <Link href='/platform-v4/buyer' className='card role blue' aria-label='Открыть сценарий трейдера или элеватора и посмотреть офферы'><h2>Я трейдер / элеватор</h2><p>Закупка через shortlist, статус банка и видимую готовность инфраструктуры.</p><strong>Смотреть офферы</strong></Link>
        </div>
        <div className='trust'>{['ФГИС «Зерно»','НСЗ','Банк-партнер','Финансирование сделки'].map((x)=><div key={x} className='card trustItem'>{x}</div>)}</div>
        <div className='stats'>{stats.map(([l,_v,s],i)=><div key={l} className='card stat'><b>{values[i].toLocaleString('ru-RU')}{s}</b><span>{l}</span></div>)}</div>
      </section>
      <section className='dash'>
        <div className='card block'><h3>Активные заявки на продажу</h3><p>Культура, цена, базис и действие.</p>{[['Пшеница 3 класса','15 200 ₽/т · Тамбов','CPT'],['Кукуруза','13 100 ₽/т · Липецк','Самовывоз'],['Соя','36 200 ₽/т · Воронеж','FOB']].map(([a,b,c])=><article key={a} className='card mini'><b>{a}</b><span>{b}</span><em>{c}</em></article>)}</div>
        <div className='card block'><h3>Очереди сделок</h3><p>Требует подписи, ожидание банка, оплачено.</p>{[['DEAL-12455','Требует подписи','28%'],['DEAL-12483','Ожидание банка','62%'],['DEAL-12411','Оплачено','100%']].map(([a,b,c])=><article key={a} className='card mini'><b>{a}</b><span>{b}</span><div className='bar'><i style={{width:c}} /></div></article>)}</div>
        <div className='card block'><h3>Проверка готовности</h3><p>Понятная матрица по регионам и услугам.</p>{[['Тамбов','Хранение ✅ · Логистика ✅ · Лаборатория ⚠️'],['Липецк','Хранение ✅ · Логистика ⚠️ · Лаборатория ✅'],['Воронеж','Хранение ⚠️ · Логистика ✅ · Лаборатория ❌']].map(([a,b])=><article key={a} className='card mini'><b>{a}</b><span>{b}</span></article>)}</div>
      </section>
    </main>
    <style jsx>{`
      .pv4r{min-height:100vh;background:linear-gradient(180deg,#eff6ff 0%,#f8fafc 48%,#f1f5f9 100%);color:#0f172a}.top{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;gap:16px;align-items:center;flex-wrap:wrap;padding:14px 16px;border-bottom:1px solid #e2e8f0;background:rgba(248,250,252,.88);backdrop-filter:blur(14px)}.top b{display:block;color:#15803d;font-size:18px}.top span{display:block;color:#64748b;font-size:12px;margin-top:4px}.top nav{display:flex;gap:12px;flex-wrap:wrap}.top a{min-height:44px;padding:0 16px;display:inline-flex;align-items:center;border:1px solid #e2e8f0;border-radius:999px;background:#fff;font-weight:700}.wrap{max-width:1440px;margin:0 auto;padding:24px 16px 48px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.1),0 1px 2px rgba(0,0,0,.06)}.hero{padding:32px}.hero small{font-size:12px;font-weight:800;letter-spacing:.08em;color:#2563eb}.hero h1{margin:12px 0 0;font-size:clamp(2.25rem,5vw,3rem);line-height:1.1}.hero p{margin:14px 0 0;max-width:760px;font-size:16px;line-height:1.6;color:#334155}.ticker,.roles,.trust,.stats{display:grid;gap:12px;margin-top:24px}.ticker{grid-template-columns:repeat(3,minmax(0,1fr))}.roles{grid-template-columns:repeat(2,minmax(0,1fr))}.trust{grid-template-columns:repeat(4,minmax(0,1fr))}.stats{grid-template-columns:repeat(3,minmax(0,1fr))}.mini{padding:16px}.mini b,.role h2,.block h3{display:block;font-size:16px;line-height:1.4}.mini span,.role p,.block p{display:block;margin-top:8px;color:#334155;line-height:1.55}.mini em{display:inline-flex;margin-top:10px;min-height:28px;padding:0 10px;align-items:center;border-radius:999px;font-style:normal;font-size:12px;font-weight:700;background:rgba(59,130,246,.08);color:#2563eb}.mini .ok{background:rgba(22,163,74,.08);color:#16a34a}.mini .bad{background:rgba(220,38,38,.08);color:#dc2626}.role{min-height:200px;padding:24px;display:flex;flex-direction:column;justify-content:space-between}.green{background:linear-gradient(180deg,#fff 0%,#f0fdf4 100%)}.blue{background:linear-gradient(180deg,#fff 0%,#eff6ff 100%)}.role strong{margin-top:20px;color:#2563eb}.trustItem{min-height:56px;display:grid;place-items:center;padding:12px;color:#64748b;font-size:14px;font-weight:700}.stat{padding:20px}.stat b{display:block;font-size:32px;line-height:1;font-variant-numeric:tabular-nums}.stat span{display:block;margin-top:10px;color:#64748b;font-size:14px;line-height:1.5}.dash{display:grid;grid-template-columns:6fr 3fr 3fr;gap:24px;margin-top:16px}.block{padding:24px}.block .mini{margin-top:12px}.bar{margin-top:12px;height:8px;border-radius:999px;background:#f1f5f9;overflow:hidden}.bar i{display:block;height:100%;background:linear-gradient(90deg,#3b82f6,#22c55e)}a:focus-visible{outline:2px solid #2563eb;outline-offset:2px}@media (max-width:1024px){.dash{grid-template-columns:1fr}}@media (max-width:768px){.ticker,.roles,.trust,.stats{grid-template-columns:1fr}.top nav{width:100%;flex-direction:column}.top a{width:100%}}
    `}</style>
  </div>
}
