import Link from 'next/link';

const TEAM = [
  {
    name: 'Максим П.',
    role: 'Директор / владелец процесса',
    access: 'Полный контур: сделки, банк, стратегия',
    note: 'Финальное решение по пилоту, клиентам и банковому сценарию.',
  },
  {
    name: 'Оператор сделки',
    role: 'Операционный контур',
    access: 'Control Tower, сделки, документы, споры',
    note: 'Следит за тем, чтобы сделка не выпадала из единого контура.',
  },
  {
    name: 'Бухгалтер / финконтур',
    role: 'Деньги и документы',
    access: 'Платежи, release, резерв, документы',
    note: 'Не должен менять логистику и полевые действия, но видит денежный слой.',
  },
  {
    name: 'Логист',
    role: 'Маршруты и рейсы',
    access: 'Логистика, водитель, приёмка',
    note: 'Управляет движением машин и фактом прибытия.',
  },
];

export default function TeamPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Команда компании</div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
          Рабочая страница multi-user контура: кто в компании за что отвечает и какой у него уровень доступа. Это P1-слой для пилота, а не финальный production IAM-модуль.
        </div>
      </section>

      <div style={{ display: 'grid', gap: 12 }}>
        {TEAM.map((member) => (
          <section key={member.name} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{member.name}</div>
                <div style={{ marginTop: 4, fontSize: 13, color: '#6B778C', fontWeight: 700 }}>{member.role}</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 11, fontWeight: 800 }}>
                Доступ
              </span>
            </div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}><strong>Контур:</strong> {member.access}</div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{member.note}</div>
          </section>
        ))}
      </div>

      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>Почему это важно</div>
        <Bullet text='Одна компания — не один пользователь. В сделке участвуют директор, оператор, бухгалтер и логист.' />
        <Bullet text='Разделение доступов снижает хаос и риск случайных действий не в своей зоне.' />
        <Bullet text='Это усиливает банковый и комплаенс-контур: видно, кто отвечает за деньги, а кто — за исполнение.' />
      </section>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link href='/platform-v7/profile' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
          Профиль компании
        </Link>
        <Link href='/platform-v7/control-tower' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
          Вернуться в платформу
        </Link>
      </div>
    </div>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#475569', lineHeight: 1.6 }}>
      <span style={{ fontWeight: 900 }}>•</span>
      <span>{text}</span>
    </div>
  );
}
