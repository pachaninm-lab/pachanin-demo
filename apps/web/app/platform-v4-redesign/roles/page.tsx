import Link from 'next/link';

const roles = [
  {
    href: '/platform-v4-redesign/seller',
    tag: 'Производитель',
    title: 'Продать зерно и видеть деньги без hidden state',
    text: 'Ожидаемые деньги, блокеры документов, лоты, история сделок и следующий шаг.',
    tone: 'green',
  },
  {
    href: '/platform-v4-redesign/buyer',
    tag: 'Покупатель',
    title: 'Выбирать shortlist, а не тонуть в витрине',
    text: 'Цена, качество, оплата, риск и готовность инфраструктуры в одном экране.',
    tone: 'blue',
  },
  {
    href: '/platform-v4-redesign/driver',
    tag: 'Водитель',
    title: 'Один рейс — один шаг — одно подтверждение',
    text: 'Полевая мобильная логика без шума, с offline queue и большим CTA.',
    tone: 'amber',
  },
  {
    href: '/platform-v4-redesign/bank',
    tag: 'Банк',
    title: 'Reserve, hold, release и mismatch без маркетингового шума',
    text: 'Строгий банковый кабинет с основаниями действия и статусом callbacks.',
    tone: 'red',
  },
  {
    href: '/platform-v4-redesign/documents',
    tag: 'Документы',
    title: 'Комплектность пакета вместо папки с PDF',
    text: 'Критично сейчас, скоро требуется, архив и прямое влияние на release.',
    tone: 'gray',
  },
  {
    href: '/platform-v4-redesign/control',
    tag: 'Контроль',
    title: 'War-room для спора, денег под риском и доказательств',
    text: 'Owner, SLA, evidence pack и влияние на деньги в одном месте.',
    tone: 'dark',
  },
] as const;

export default function Page() {
  return (
    <div className='rolesPage'>
      <div className='wrap'>
        <Link href='/platform-v4-redesign' className='back'>← Назад к главной</Link>

        <section className='intro'>
          <div className='eyebrow'>Role-first UX</div>
          <h1>Теперь это не тот же зелёный экран. Вход строится как каталог рабочих мест.</h1>
          <p>
            Роль больше не выглядит как огромная однотипная карточка из старого контура. Каждое рабочее место описано задачей, риском и ожидаемым действием.
          </p>
        </section>

        <section className='quick'>
          <Link href='/platform-v4-redesign/seller' className='pill primary'>Продавец</Link>
          <Link href='/platform-v4-redesign/buyer' className='pill'>Покупатель</Link>
          <Link href='/platform-v4-redesign/driver' className='pill'>Водитель</Link>
          <Link href='/platform-v4-redesign/bank' className='pill'>Банк</Link>
        </section>

        <section className='grid'>
          {roles.map((role) => (
            <Link key={role.href} href={role.href} className={`card ${role.tone}`}>
              <div className='tag'>{role.tag}</div>
              <h2>{role.title}</h2>
              <p>{role.text}</p>
              <span className='open'>Открыть рабочее место</span>
            </Link>
          ))}
        </section>
      </div>

      <style jsx>{`
        .rolesPage{min-height:100vh;background:linear-gradient(180deg,#f8fbff 0%,#ffffff 46%,#f5f7fb 100%);color:#0f172a}
        .wrap{max-width:1280px;margin:0 auto;padding:28px 16px 56px}
        .back{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid #dbe3ee;background:#fff;font-weight:700;color:#2563eb}
        .intro{margin-top:18px;padding:32px;border-radius:28px;background:#fff;border:1px solid #e5e7eb;box-shadow:0 10px 30px rgba(15,23,42,.05)}
        .eyebrow{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#2563eb}
        h1{margin:14px 0 0;font-size:clamp(2.4rem,4.8vw,4.5rem);line-height:1.02;letter-spacing:-.03em;max-width:12ch}
        .intro p{margin:18px 0 0;max-width:780px;font-size:18px;line-height:1.65;color:#475569}
        .quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:20px}
        .pill{display:flex;align-items:center;justify-content:center;min-height:56px;border-radius:18px;background:#fff;border:1px solid #dbe3ee;font-size:18px;font-weight:800;color:#0f172a}.pill.primary{background:#0f172a;color:#fff;border-color:#0f172a}
        .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin-top:20px}
        .card{padding:28px;border-radius:24px;border:1px solid #e5e7eb;background:#fff;box-shadow:0 10px 30px rgba(15,23,42,.05);color:#0f172a}
        .tag{display:inline-flex;align-items:center;min-height:34px;padding:0 12px;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
        h2{margin:18px 0 0;font-size:32px;line-height:1.08;letter-spacing:-.03em;max-width:14ch}
        .card p{margin:14px 0 0;color:#475569;font-size:17px;line-height:1.65;max-width:36ch}
        .open{display:inline-flex;align-items:center;margin-top:22px;font-weight:800;color:#2563eb}
        .green .tag{background:#ecfdf3;color:#15803d}.blue .tag{background:#eff6ff;color:#2563eb}.amber .tag{background:#fffbeb;color:#b45309}.red .tag{background:#fef2f2;color:#dc2626}.gray .tag{background:#f1f5f9;color:#475569}.dark .tag{background:#0f172a;color:#fff}
        a:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
        @media (max-width:1024px){.grid,.quick{grid-template-columns:1fr 1fr}h1{max-width:none}}
        @media (max-width:768px){.wrap{padding:18px 14px 40px}.intro{padding:24px;border-radius:22px}.quick,.grid{grid-template-columns:1fr}.pill{min-height:52px;font-size:17px}h1{font-size:clamp(2rem,9vw,3rem)}.intro p{font-size:16px}h2{font-size:28px}}
      `}</style>
    </div>
  );
}
