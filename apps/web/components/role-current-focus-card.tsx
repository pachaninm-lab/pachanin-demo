import Link from 'next/link';
import type { RoleCurrentFocus } from '../lib/industrialization-server';

export function RoleCurrentFocusCard({ focus }: { focus: RoleCurrentFocus | null }) {
  if (!focus) return null;
  return (
    <section className="card">
      <div className="section-title">Текущий объект роли</div>
      <div className="muted small" style={{ marginTop: 8 }}>
        Кабинет должен открывать не список модулей, а ближайший объект, который реально надо закрыть сейчас.
      </div>
      <div className="soft-box" style={{ marginTop: 12 }}>
        <b>{focus.title}</b>
        <div className="muted small" style={{ marginTop: 6 }}>{focus.detail}</div>
        <div className="detail-meta" style={{ marginTop: 8 }}>
          {focus.chips.map((chip) => <span key={chip} className="mini-chip">{chip}</span>)}
        </div>
        <div className="muted tiny" style={{ marginTop: 8 }}>{focus.nextStep}</div>
      </div>
      <div className="cta-stack" style={{ marginTop: 14 }}>
        <Link href={focus.href} className="primary-link">Открыть объект</Link>
      </div>
    </section>
  );
}
