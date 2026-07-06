import { BrandMark } from '@/components/v7r/BrandMark';
import { RoleCockpitLoading } from '@/components/platform-v7/RoleCockpitLoading';

export default function PlatformV7Loading() {
  return (
    <main className='p7-route-loading' aria-label='Загрузка Прозрачной Цены'>
      <div className='p7-loading-public-head' aria-label='Шапка загрузки Прозрачной Цены'>
        <span className='p7-loading-brand'><BrandMark size={38} /></span>
        <span>
          <strong>Прозрачная Цена</strong>
          <small>загрузка рабочего экрана</small>
        </span>
      </div>
      <section className='p7-route-loading-card'>
        <strong>Загружаем экран платформы</strong>
        <RoleCockpitLoading />
      </section>
      <style>{`
        .p7-route-loading{width:100%;max-width:1180px;margin:0 auto;padding:calc(env(safe-area-inset-top,0px) + 88px) 14px calc(env(safe-area-inset-bottom,0px) + 120px);display:grid;gap:16px}
        .p7-loading-public-head{position:fixed;left:0;right:0;top:0;z-index:90;display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top,0px) + 8px) 14px 8px;background:rgba(255,255,255,.94);border-bottom:1px solid var(--pc-border,rgba(15,23,42,.10));backdrop-filter:blur(18px);box-shadow:0 10px 28px rgba(15,23,42,.06)}
        .p7-loading-brand{display:inline-flex;width:42px;height:42px;align-items:center;justify-content:center;flex:0 0 42px}
        .p7-loading-public-head strong{display:block;color:var(--pc-text-primary,#111827);font-size:15px;line-height:1.1;font-weight:950}
        .p7-loading-public-head small{display:block;color:var(--pc-text-muted,#64748b);font-size:11px;line-height:1.25;font-weight:750}
        .pc-shell-root-v4 .p7-loading-public-head{display:none!important}
        .pc-shell-root-v4 .p7-route-loading{padding-top:0!important;padding-bottom:0!important}
        .p7-route-loading-card{border:1px solid var(--pc-border,rgba(15,23,42,.10));border-radius:24px;background:var(--pc-bg-card,rgba(255,255,255,.94));padding:18px;box-shadow:0 16px 38px rgba(15,23,42,.06)}
        .p7-route-loading-card>strong{display:block;margin-bottom:12px;font-size:16px;line-height:1.2}
      `}</style>
    </main>
  );
}
