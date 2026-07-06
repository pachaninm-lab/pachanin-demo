import { RoleCockpitLoading } from '@/components/platform-v7/RoleCockpitLoading';

export default function PlatformV7Loading() {
  return (
    <main className='p7-route-loading' aria-label='Загрузка Прозрачной Цены'>
      <section className='p7-route-loading-card'>
        <strong>Загружаем экран платформы</strong>
        <RoleCockpitLoading />
      </section>
      <style>{`
        .p7-route-loading{width:100%;max-width:1180px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 88px) 14px calc(env(safe-area-inset-bottom,0px) + 120px);display:grid;gap:16px}
        .p7-route-loading-card{border:1px solid var(--pc-border,rgba(15,23,42,.10));border-radius:24px;background:var(--pc-bg-card,rgba(255,255,255,.94));padding:18px;box-shadow:0 16px 38px rgba(15,23,42,.06)}
        .p7-route-loading-card>strong{display:block;margin-bottom:12px;font-size:16px;line-height:1.2}
      `}</style>
    </main>
  );
}
