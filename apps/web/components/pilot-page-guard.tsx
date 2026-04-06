'use client';

/**
 * Pages wrapped with this component are hidden during pilot.
 * They show a "Coming soon" message instead of empty content.
 */
export function PilotPageGuard({ title, children }: { title: string; children?: React.ReactNode }) {
  const isPilot = typeof window !== 'undefined' && window.location.hostname !== 'production.prozrachnaya-cena.ru';

  if (isPilot && !children) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚧</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{title}</h2>
        <p style={{ color: '#94A3B8', fontSize: 14 }}>Этот раздел находится в разработке и будет доступен в следующих версиях платформы.</p>
      </div>
    );
  }

  return <>{children}</>;
}
