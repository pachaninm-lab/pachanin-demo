import Link from 'next/link';
import { ArrowRight, Clock3, ListChecks } from 'lucide-react';
import { getRoleIntentConfig } from '@/lib/platform-v7/roleIntentActions';
import { platformV7RouteIcon } from '@/lib/platform-v7/platformV7RouteIcons';
import type { PlatformRole } from '@/stores/usePlatformV7RStore';

export function RoleIntentDashboard({ role }: { role: PlatformRole }) {
  const config = getRoleIntentConfig(role);

  if (!config) return null;

  return (
    <section style={{ display: 'grid', gap: 14 }} data-role-intent-dashboard={role}>
      <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 22, padding: 18, boxShadow: 'var(--pc-shadow-sm)', display: 'grid', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 900, color: 'var(--pc-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Что хотите сделать?</span>
        <h1 style={{ margin: 0, fontSize: 'clamp(22px, 5vw, 34px)', lineHeight: 1.08, color: 'var(--pc-text-primary)' }}>{config.title}</h1>
        <p style={{ margin: 0, maxWidth: 820, fontSize: 13, lineHeight: 1.55, color: 'var(--pc-text-secondary)' }}>{config.subtitle}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 10 }}>
        {config.primaryActions.map((action) => {
          const Icon = platformV7RouteIcon(action.iconKey);

          return (
            <Link
              key={`${role}-${action.label}`}
              href={action.href}
              style={{ textDecoration: 'none', color: 'var(--pc-text-primary)', border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 18, padding: 14, minHeight: 126, display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: 10, boxShadow: 'var(--pc-shadow-xs)' }}
            >
              <span style={{ width: 34, height: 34, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--pc-accent-bg)', border: '1px solid var(--pc-accent-border)', color: 'var(--pc-accent)' }}><Icon size={17} /></span>
              <span style={{ display: 'grid', gap: 5 }}>
                <strong style={{ fontSize: 15, lineHeight: 1.25 }}>{action.label}</strong>
                <span style={{ fontSize: 12, lineHeight: 1.45, color: 'var(--pc-text-secondary)' }}>{action.description}</span>
              </span>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', fontSize: 11, color: 'var(--pc-text-muted)' }}>
                <span>{action.resultLabel}</span>
                <ArrowRight size={14} />
              </span>
            </Link>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 12 }}>
        <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17, display: 'inline-flex', alignItems: 'center', gap: 8 }}><ListChecks size={17} />Требует внимания</h2>
          {config.attentionItems.map((item) => {
            const Icon = platformV7RouteIcon(item.iconKey);
            return (
              <Link key={`${role}-attention-${item.label}`} href={item.href} style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 9, alignItems: 'center', padding: '10px 11px', borderRadius: 13, border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface-soft)', color: 'var(--pc-text-primary)' }}>
                <Icon size={15} />
                <span style={{ display: 'grid', gap: 2 }}>
                  <strong style={{ fontSize: 12 }}>{item.label}</strong>
                  <span style={{ fontSize: 10, color: 'var(--pc-text-muted)' }}>{item.owner} · {item.resultLabel}</span>
                </span>
                <ArrowRight size={13} />
              </Link>
            );
          })}
        </div>

        <div style={{ border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface)', borderRadius: 20, padding: 16, display: 'grid', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Clock3 size={17} />Продолжить начатое</h2>
          {config.continueItems.map((item) => {
            const Icon = platformV7RouteIcon(item.iconKey);
            return (
              <Link key={`${role}-continue-${item.label}`} href={item.href} style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 9, alignItems: 'center', padding: '10px 11px', borderRadius: 13, border: '1px solid var(--pc-border)', background: 'var(--pc-shell-surface-soft)', color: 'var(--pc-text-primary)' }}>
                <Icon size={15} />
                <span style={{ display: 'grid', gap: 2 }}>
                  <strong style={{ fontSize: 12 }}>{item.label}</strong>
                  <span style={{ fontSize: 10, color: 'var(--pc-text-muted)' }}>{item.owner} · {item.resultLabel}</span>
                </span>
                <ArrowRight size={13} />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
