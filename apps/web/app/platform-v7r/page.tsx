'use client';
import { useRouter } from 'next/navigation';
import { usePlatformV7RStore, type PlatformRole } from '@/stores/usePlatformV7RStore';

const cards: Array<{ role: PlatformRole; title: string; desc: string; href: string }> = [
  { role: 'operator', title: 'Оператор', desc: 'Контроль сделок, денег, блокеров и next action.', href: '/platform-v7/control-tower' },
  { role: 'buyer', title: 'Покупатель', desc: 'Закупка, shortlist, спорные партии и выплата.', href: '/platform-v7/buyer' },
  { role: 'seller', title: 'Продавец', desc: 'Где деньги, что мешает выплате и какие нужны документы.', href: '/platform-v7/seller' },
  { role: 'driver', title: 'Полевой контур', desc: 'Водитель, сюрвейер, элеватор и лаборант в одном полевом экране.', href: '/platform-v7/field' },
  { role: 'bank', title: 'Банк', desc: 'Резерв, удержание, callbacks и выпуск средств.', href: '/platform-v7/bank' },
  { role: 'arbitrator', title: 'Арбитр', desc: 'War-room, evidence pack и решение споров.', href: '/platform-v7/disputes' },
];

export default function PlatformV7RRootPage() {
  const router = useRouter();
  const { roleSelected, setRole } = usePlatformV7RStore();

  if (roleSelected) {
    router.replace('/platform-v7/control-tower');
    return null;
  }

  return (
    <div style={{ minHeight: 'calc(100dvh - 72px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 1120 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 12, color: '#0A7A5F', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800 }}>Прозрачная Цена</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0F1419', margin: '10px 0 8px' }}>Выбери роль</h1>
          <p style={{ fontSize: 14, color: '#6B778C', margin: 0 }}>Первый вход начинается не с чужого кабинета, а с твоего рабочего контура.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {cards.map((card) => (
            <button
              key={card.role}
              onClick={() => {
                setRole(card.role);
                router.push(card.href);
              }}
              style={{ textAlign: 'left', padding: '20px 18px', background: '#fff', border: '1px solid #E4E6EA', borderRadius: 12, cursor: 'pointer', boxShadow: '0 8px 24px rgba(9,30,66,0.06)' }}
            >
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(10,122,95,0.08)', color: '#0A7A5F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, marginBottom: 14 }}>{card.title.slice(0, 1)}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0F1419' }}>{card.title}</div>
              <div style={{ fontSize: 13, color: '#6B778C', marginTop: 8, lineHeight: 1.5 }}>{card.desc}</div>
              <div style={{ marginTop: 16, fontSize: 12, fontWeight: 700, color: '#0A7A5F' }}>Продолжить →</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
