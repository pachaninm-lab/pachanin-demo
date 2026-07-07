import Link from 'next/link';
import { AlertTriangle, ArrowRight, BadgeCheck, CheckCircle2, CircleDollarSign, ClipboardList, FileCheck2, ListChecks, ShieldCheck } from 'lucide-react';
import { AUCTION_DEAL_BASIS, auctionDealAmountRub, guardAuctionDealBasisReady } from '@/lib/platform-v7/auctionDealBridge';
import { platformV7RouteIcon } from '@/lib/platform-v7/platformV7RouteIcons';

const money = new Intl.NumberFormat('ru-RU');
const DealIcon = platformV7RouteIcon('deal');
const AuctionIcon = platformV7RouteIcon('auction');
const FgisIcon = platformV7RouteIcon('fgis');
const LogisticsIcon = platformV7RouteIcon('logistics');

export default function AuctionDealBasisPage() {
  const basis = AUCTION_DEAL_BASIS;

  if (!basis) {
    return (
      <main style={{ display: 'grid', gap: 16 }}>
        <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-danger)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 7 }}><AlertTriangle size={16} />Основание не готово</span>
          <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 38px)', color: 'var(--pc-text-primary)', lineHeight: 1.08 }}>Нет зафиксированного победителя</h1>
          <p style={{ margin: 0, maxWidth: 760, fontSize: 14, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>Сделку нельзя продолжить без победившей ставки. Вернитесь к журналу ставок и зафиксируйте победителя.</p>
          <Link href='/platform-v7/auction/bids' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content', padding: '10px 12px', borderRadius: 14, background: 'var(--pc-accent)', color: '#fff', fontSize: 13, fontWeight: 900 }}><AuctionIcon size={16} />Вернуться к ставкам</Link>
        </section>
      </main>
    );
  }

  const guard = guardAuctionDealBasisReady(basis);
  const amount = money.format(auctionDealAmountRub());

  return (
    <main style={{ display: 'grid', gap: 16 }}>
      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 7 }}><DealIcon size={16} />Победитель → основание сделки</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 38px)', color: 'var(--pc-text-primary)', lineHeight: 1.08 }}>Основание сделки</h1>
        <p style={{ margin: 0, maxWidth: 820, fontSize: 14, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>Победившая ставка связана с ФГИС-лотом, СДИЗ, владельцем, покупателем, объёмом и суммой. Рейс формируется из этого основания; банковский блок получает только проверяемое основание, без обещания автоматического выпуска денег.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href='/platform-v7/auction/bids' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content', padding: '10px 12px', borderRadius: 14, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', fontSize: 13, fontWeight: 900 }}><AuctionIcon size={16} />Вернуться к ставкам</Link>
          <Link href='/platform-v7/deal-logistics' style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, width: 'fit-content', padding: '10px 12px', borderRadius: 14, background: 'var(--pc-accent)', color: '#fff', fontSize: 13, fontWeight: 900 }}><LogisticsIcon size={16} />Назначить рейс</Link>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
        {[
          ['Победитель', basis.buyerName],
          ['Цена победителя', `${money.format(basis.priceRubPerTon)} ₽/т`],
          ['ФГИС-лот', basis.lotNumber],
          ['СДИЗ', basis.sdizNumber],
          ['Владелец', `${basis.sellerName} · ИНН ${basis.ownerInn}`],
          ['Покупатель', basis.buyerName],
          ['Объём', `${basis.volumeTons} т`],
          ['Сумма', `${amount} ₽`],
          ['Условия поставки', basis.deliveryTerms],
          ['Место хранения', basis.storagePlace],
        ].map(([label, value]) => (
          <div key={label} style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 18, padding: 14, display: 'grid', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--pc-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 6 }}><FgisIcon size={14} />{label}</span>
            <strong style={{ fontSize: 15, color: 'var(--pc-text-primary)', lineHeight: 1.28 }}>{value}</strong>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
        <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }}><ClipboardList size={18} />Что фиксируется в журнале</h2>
          {basis.journalLocks.map((item) => (
            <div key={item.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 13, border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface-soft)' }}>
              <strong style={{ fontSize: 13, color: 'var(--pc-text-primary)', lineHeight: 1.3 }}>{item.label}</strong>
              <span style={{ fontSize: 10, color: 'var(--pc-text-muted)', whiteSpace: 'nowrap' }}>{item.owner}</span>
            </div>
          ))}
        </div>

        <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }}><ShieldCheck size={18} />Почему можно формировать рейс</h2>
          {basis.readinessReasons.map((item) => (
            <div key={item} style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--pc-text-secondary)', padding: '9px 11px', borderRadius: 12, background: 'var(--pc-shell-surface-soft)', border: '1px solid var(--pc-border)', display: 'flex', gap: 8, alignItems: 'flex-start' }}><CheckCircle2 size={15} style={{ flex: '0 0 auto', marginTop: 1 }} />{item}</div>
          ))}
        </div>
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }}><ListChecks size={18} />Guard основания сделки</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }}>
          {guard.map((item) => (
            <div key={item.key} style={{ padding: 12, borderRadius: 14, border: '1px solid var(--pc-border)', background: item.status === 'ok' ? 'var(--pc-accent-bg)' : 'var(--pc-shell-surface-soft)', display: 'grid', gap: 4 }}>
              <strong style={{ fontSize: 12, color: 'var(--pc-text-primary)', display: 'inline-flex', alignItems: 'center', gap: 7 }}><BadgeCheck size={14} />{item.label}</strong>
              <span style={{ fontSize: 10, color: 'var(--pc-text-muted)' }}>{item.owner} · {item.status === 'ok' ? 'проверено' : 'блокировка'}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }}><CircleDollarSign size={18} />Следующее действие</h2>
        {basis.nextRoutes.map((action) => {
          const Icon = platformV7RouteIcon(action.iconKey);

          return (
            <Link key={action.href} href={action.href} style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '11px 12px', borderRadius: 14, border: '1px solid var(--pc-border)', color: 'var(--pc-text-primary)', background: action.href === '/platform-v7/deal-logistics' ? 'var(--pc-accent-bg)' : 'var(--pc-shell-surface-soft)' }}>
              <Icon size={17} />
              <span style={{ display: 'grid', gap: 3 }}>
                <strong style={{ fontSize: 13 }}>{action.label}</strong>
                <span style={{ fontSize: 11, color: 'var(--pc-text-muted)', lineHeight: 1.35 }}>{action.resultLabel}</span>
              </span>
              <ArrowRight size={15} />
            </Link>
          );
        })}
      </section>

      <section style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18, display: 'inline-flex', alignItems: 'center', gap: 8 }}><FileCheck2 size={18} />Ограничение денежного контура</h2>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--pc-text-secondary)' }}>Этот экран не подтверждает live banking и не выпускает деньги. Он собирает проверяемое основание: победитель, ФГИС-лот, СДИЗ, объём, сумма, поставка, журнал и следующий рейс.</p>
      </section>
    </main>
  );
}
