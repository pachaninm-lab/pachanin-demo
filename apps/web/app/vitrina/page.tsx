import Link from 'next/link';
import { PageAccessGuard } from '../../components/page-access-guard';
import { ALL_AUTHENTICATED_ROLES } from '../../lib/route-roles';

export const metadata = {
  title: 'Маркетплейс зерна — Прозрачная Цена',
  description: 'Лоты: пшеница, ячмень, подсолнечник, кукуруза, горох. ЦФО. Прямые сделки без посредников.',
};

type PublicLot = {
  id: string;
  title: string;
  volume: number;
  price: number;
  region: string;
  seller: string;
};

const FALLBACK_LOTS: PublicLot[] = [
  { id: '1', title: 'Пшеница 3 класс', volume: 240, price: 16500, region: 'Тамбовская обл.', seller: 'КФХ Алексеев' },
  { id: '2', title: 'Подсолнечник', volume: 150, price: 32000, region: 'Тамбовская обл.', seller: 'ООО АгроЦентр' },
  { id: '3', title: 'Ячмень фуражный', volume: 300, price: 12800, region: 'Тамбовская обл.', seller: 'ИП Воронцов' },
  { id: '4', title: 'Горох', volume: 200, price: 18000, region: 'Тамбовская обл.', seller: 'КФХ Алексеев' },
  { id: '5', title: 'Нут', volume: 100, price: 35000, region: 'Тамбовская обл.', seller: 'ООО АгроЦентр' },
];

async function loadPublicLots(): Promise<PublicLot[]> {
  const apiUrl = String(process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (!apiUrl) return FALLBACK_LOTS;
  try {
    const response = await fetch(`${apiUrl}/lots/public`, { next: { revalidate: 300 } } as RequestInit);
    if (!response.ok) return FALLBACK_LOTS;
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload) || !payload.length) return FALLBACK_LOTS;
    return payload
      .map((item, index) => ({
        id: String((item as Record<string, unknown>).id || index + 1),
        title: String((item as Record<string, unknown>).title || 'Без названия'),
        volume: Number((item as Record<string, unknown>).volume || 0),
        price: Number((item as Record<string, unknown>).price || 0),
        region: String((item as Record<string, unknown>).region || '—'),
        seller: String((item as Record<string, unknown>).seller || '—'),
      }))
      .filter((item) => item.volume > 0 && item.price > 0);
  } catch {
    return FALLBACK_LOTS;
  }
}

export default async function PublicVitrina() {
  const lots = await loadPublicLots();

  return (
    <PageAccessGuard
      allowedRoles={['GUEST', ...ALL_AUTHENTICATED_ROLES]}
      title="Публичная витрина доступна всем"
      subtitle="Этот экран можно открывать гостю, но путь дальше должен вести либо в регистрацию, либо в рабочий кабинет по роли."
    >
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🌾</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0A5C36', margin: 0 }}>Маркетплейс зерна</h1>
          <p style={{ color: '#666', marginTop: 8 }}>Прямые сделки без посредников · ЦФО · 17 культур</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lots.map((lot) => (
            <div
              key={lot.id}
              style={{
                border: '1px solid #E5E7EB',
                borderRadius: 12,
                padding: 16,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{lot.title}</div>
                <div style={{ color: '#666', fontSize: 13, marginTop: 2 }}>
                  {lot.volume} т · {lot.region} · {lot.seller}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#0A5C36' }}>
                  {lot.price.toLocaleString('ru-RU')} ₽/т
                </div>
                <div style={{ color: '#999', fontSize: 12 }}>{(lot.volume * lot.price).toLocaleString('ru-RU')} ₽</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 32, padding: 24, background: '#E8F5E9', borderRadius: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#0A5C36', margin: '0 0 8px' }}>Хотите сделать ставку?</h2>
          <p style={{ color: '#666', fontSize: 14, marginBottom: 16 }}>Зарегистрируйтесь за 2 минуты</p>
          <Link
            href="/onboarding"
            style={{
              display: 'inline-block',
              padding: '12px 32px',
              background: '#0A5C36',
              color: '#fff',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Зарегистрироваться
          </Link>
        </div>
      </div>
    </PageAccessGuard>
  );
}
