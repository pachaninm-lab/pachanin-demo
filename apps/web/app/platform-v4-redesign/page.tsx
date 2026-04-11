'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

const crops = [
  ['Пшеница', '15 200 ₽/т', '+2.4%', 'CPT Тамбов'],
  ['Кукуруза', '13 100 ₽/т', '-1.1%', 'EXW элеватор'],
  ['Соя', '36 200 ₽/т', '+1.8%', 'FOB склад'],
] as const;

const stats = [
  ['Активные заявки', 128, ''],
  ['Объем в торгах', 24500, ' т'],
  ['Успешные сделки', 864, ''],
] as const;

const shortcuts = [
  { href: '/platform-v4-redesign/roles', title: 'Вход по роли', text: 'Производитель, покупатель, водитель, банк, контроль' },
  { href: '/platform-v4-redesign/deal', title: 'Центр сделки', text: 'Статус, деньги, документы, спор, следующий шаг' },
  { href: '/platform-v4-redesign/bank', title: 'Деньги и выпуск', text: 'Reserve, hold, callbacks, mismatch, release' },
];

export default function Page() {
  const [values, setValues] = useState([0, 0, 0]);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setValues(stats.map((s) => s[1]));
      return;
    }
    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - started) / 900, 1);
      setValues(stats.map((s) => Math.round(s[1] * p)));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className='pv4r'>
      <header className='top'>
        <div className='brand'>
          <b>Прозрачная Цена</b>
          <span>Production-style redesign preview</span>
        </div>
        <nav>
          <Link href='/platform-v4-redesign/roles'>Роли</Link>
          <Link href='/platform-v4-redesign/deal'>Сделка</Link>
          <Link href='/platform-v4-redesign/bank'>Деньги</Link>
        </nav>
      </header>

      <main className='wrap'>
        <section className='hero'>
          <div className='heroCopy'>
            <div className='eyebrow'>Безопасная сделка с зерном</div>
            <h1>Не витрина. Центр управления ценой, документами и деньгами.</h1>
            <p>
              Первый экран теперь не похож на старый зелёный demo-щит. Он объясняет продукт за несколько секунд: что продается, как контролируются деньги и куда входить по роли.
            </p>
            <div className='heroActions'>
              <Link href='/platform-v4-redesign/roles' className='cta primary'>Выбрать роль</Link>
              <Link href='/platform-v4-redesign/deal' className='cta'>Открыть сделку</Link>
            </div>
          </div>
          <div className='heroPanel'>
            <div className='panelTitle'>Рынок сейчас</div>
            <div className='ticker'>
              {crops.map(([name, price, delta, basis]) => (
                <article key={name} className='tickerCard'>
                  <div>
                    <b>{name}</b>
                    <span>{basis}</span>
                  </div>
                  <strong>{price}</strong>
                  <em className={delta.startsWith('+') ? 'up' : 'down'}>{delta}</em>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className='trust'>
          {['ФГИС «Зерно»', 'НСЗ', 'Банк-партнер', 'Безопасный выпуск денег'].map((x) => (
            <div key={x} className='trustItem'>{x}</div>
          ))}
        </section>

        <section className='stats'>
          {stats.map(([label, _value, suffix], i) => (
            <article key={label} className='stat'>
              <b>{values[i].toLocaleString('ru-RU')}{suffix}</b>
              <span>{label}</span>
            </article>
          ))}
        </section>

        <section className='shortcuts'>
          {shortcuts.map((item) => (
            <Link key={item.href} href={item.href} className='shortcut'>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </Link>
          ))}
        </section>
      </main>

      <style jsx>{`
        .pv4r{min-height:100vh;background:linear-gradient(180deg,#f8fbff 0%,#ffffff 46%,#f5f7fb 100%);color:#0f172a}
        .top{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 20px;background:rgba(255,255,255,.82);backdrop-filter:blur(14px);border-bottom:1px solid #e5e7eb}
        .brand b{display:block;font-size:18px;color:#0f172a}.brand span{display:block;font-size:12px;color:#64748b;margin-top:4px}
        nav{display:flex;gap:12px;flex-wrap:wrap}
        nav a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border:1px solid #dbe3ee;border-radius:999px;background:#fff;font-weight:700;color:#0f172a}
        .wrap{max-width:1280px;margin:0 auto;padding:32px 16px 56px}
        .hero{display:grid;grid-template-columns:1.1fr .9fr;gap:24px;align-items:stretch}
        .heroCopy,.heroPanel,.stat,.shortcut,.trustItem{background:#fff;border:1px solid #e5e7eb;border-radius:24px;box-shadow:0 10px 30px rgba(15,23,42,.05)}
        .heroCopy{padding:36px}.eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#2563eb}
        h1{margin:14px 0 0;font-size:clamp(2.6rem,5vw,4.25rem);line-height:1.02;letter-spacing:-.03em;max-width:9.5ch}
        .heroCopy p{margin:18px 0 0;max-width:620px;font-size:18px;line-height:1.65;color:#475569}
        .heroActions{display:flex;gap:12px;flex-wrap:wrap;margin-top:28px}.cta{display:inline-flex;align-items:center;justify-content:center;min-height:52px;padding:0 22px;border-radius:16px;border:1px solid #dbe3ee;background:#fff;font-weight:800}.cta.primary{background:#0f172a;color:#fff;border-color:#0f172a}
        .heroPanel{padding:24px}.panelTitle{font-size:14px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.08em}
        .ticker{display:grid;gap:12px;margin-top:18px}.tickerCard{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:16px;border:1px solid #e5e7eb;border-radius:18px;background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%)}
        .tickerCard b{display:block;font-size:17px}.tickerCard span{display:block;margin-top:4px;color:#64748b;font-size:13px}.tickerCard strong{font-size:18px;font-variant-numeric:tabular-nums}.tickerCard em{display:inline-flex;align-items:center;justify-content:center;min-width:72px;min-height:32px;border-radius:999px;font-style:normal;font-size:13px;font-weight:800}.up{background:#ecfdf3;color:#15803d}.down{background:#fef2f2;color:#dc2626}
        .trust,.stats,.shortcuts{display:grid;gap:16px;margin-top:24px}.trust{grid-template-columns:repeat(4,minmax(0,1fr))}.trustItem{min-height:72px;display:grid;place-items:center;padding:12px;color:#334155;font-size:14px;font-weight:800;text-align:center}
        .stats{grid-template-columns:repeat(3,minmax(0,1fr))}.stat{padding:26px}.stat b{display:block;font-size:36px;line-height:1;font-variant-numeric:tabular-nums}.stat span{display:block;margin-top:10px;color:#64748b;font-size:14px}
        .shortcuts{grid-template-columns:repeat(3,minmax(0,1fr))}.shortcut{padding:24px;color:#0f172a}.shortcut h2{margin:0;font-size:24px;line-height:1.15}.shortcut p{margin:10px 0 0;color:#475569;line-height:1.6}
        a:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
        @media (max-width:1024px){.hero,.trust,.stats,.shortcuts{grid-template-columns:1fr}}
        @media (max-width:768px){.top{padding:14px 16px}.top nav{width:100%;display:grid;grid-template-columns:1fr}.wrap{padding:20px 14px 40px}.heroCopy,.heroPanel,.stat,.shortcut,.trustItem{border-radius:20px}.heroCopy{padding:24px}h1{font-size:clamp(2.2rem,10vw,3.2rem);max-width:none}.heroCopy p{font-size:16px}.heroActions{display:grid;grid-template-columns:1fr}.cta{width:100%}.tickerCard{grid-template-columns:1fr;gap:8px}.tickerCard em{min-width:0;width:max-content}.stat{padding:20px}}
      `}</style>
    </div>
  );
}
