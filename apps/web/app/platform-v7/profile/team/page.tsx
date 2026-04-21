import Link from 'next/link';

const TEAM = [
  {
    name: 'Максим П.',
    role: 'Директор / владелец процесса',
    access: 'Полный контур: сделки, банк, стратегия',
    note: 'Финальное решение по пилоту, клиентам и банковому сценарию.',
    status: 'Активен',
    rights: ['Сделки', 'Банк', 'Контрагенты', 'Настройки компании', 'Отчёты'],
  },
  {
    name: 'Оператор сделки',
    role: 'Операционный контур',
    access: 'Control Tower, сделки, документы, споры',
    note: 'Следит за тем, чтобы сделка не выпадала из единого контура.',
    status: 'Активен',
    rights: ['Control Tower', 'Сделки', 'Документы', 'Споры'],
  },
  {
    name: 'Бухгалтер / финконтур',
    role: 'Деньги и документы',
    access: 'Платежи, release, резерв, документы',
    note: 'Не должен менять логистику и полевые действия, но видит денежный слой.',
    status: 'Ограниченный доступ',
    rights: ['Платежи', 'Резерв', 'Release', 'Документы'],
  },
  {
    name: 'Логист',
    role: 'Маршруты и рейсы',
    access: 'Логистика, водитель, приёмка',
    note: 'Управляет движением машин и фактом прибытия.',
    status: 'Активен',
    rights: ['Логистика', 'Водитель', 'Приёмка'],
  },
];

const IAM_METRICS = [
  { label: 'Пользователей', value: '4', note: 'Активные члены команды в контуре' },
  { label: 'Ролей', value: '4', note: 'Директор, оператор, бухгалтер, логист' },
  { label: 'Ограничений', value: '6', note: 'Денежный слой и операционные границы доступа' },
];

export default function TeamPage() {
  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 1040, margin: '0 auto' }}>
      <section style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#0F1419' }}>Команда компании</div>
            <div style={{ marginTop: 8, fontSize: 13, color: '#6B778C', lineHeight: 1.7 }}>
              Рабочая страница multi-user контура: кто в компании за что отвечает, какой у него уровень доступа и где проходит граница между деньгами, исполнением и стратегией.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href='/platform-v7/register' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, background: '#0A7A5F', border: '1px solid #0A7A5F', color: '#fff', fontSize: 13, fontWeight: 800 }}>
              Пригласить участника
            </Link>
            <Link href='/platform-v7/auth' style={{ textDecoration: 'none', padding: '10px 14px', borderRadius: 12, border: '1px solid #E4E6EA', background: '#fff', color: '#0F1419', fontSize: 13, fontWeight: 700 }}>
              Контур доступа
            </Link>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {IAM_METRICS.map((item) => (
          <div key={item.label} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18 }}>
            <div style={{ fontSize: 11, color: '#6B778C', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{item.label}</div>
            <div style={{ marginTop: 8, fontSize: 28, fontWeight: 800, color: '#0F1419' }}>{item.value}</div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6B778C', lineHeight: 1.6 }}>{item.note}</div>
          </div>
        ))}
      </section>

      <div style={{ display: 'grid', gap: 12 }}>
        {TEAM.map((member) => (
          <section key={member.name} style={{ background: '#fff', border: '1px solid #E4E6EA', borderRadius: 18, padding: 18, display: 'grid', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{member.name}</div>
                <div style={{ marginTop: 4, fontSize: 13, color: '#6B778C', fontWeight: 700 }}>{member.role}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: 'rgba(10,122,95,0.08)', border: '1px solid rgba(10,122,95,0.18)', color: '#0A7A5F', fontSize: 11, fontWeight: 800 }}>
                  {member.status}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 11, fontWeight: 800 }}>
                  Доступ
                </span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}><strong>Контур:</strong> {member.access}</div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.7 }}>{member.note}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {member.rights.map((item) => (
                <span key={item} style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 10px', borderRadius: 999, background: '#F8FAFB', border: '1px solid #E4E6EA', color: '#475569', fontSize: 12, fontWeight: 700 }}>
                  {item}
                </span>
              ))}
            </div>
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
