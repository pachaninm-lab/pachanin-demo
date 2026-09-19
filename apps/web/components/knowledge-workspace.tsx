'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

type Article = {
  id: string;
  title: string;
  summary: string;
  role: string;
  calculators: string[];
  linkedModules: Array<{ href: string; label: string }>;
};

export function KnowledgeWorkspace({ initialArticles }: { initialArticles: Article[] }) {
  const [role, setRole] = useState('');
  const [query, setQuery] = useState('');
  const roles = useMemo(() => Array.from(new Set(initialArticles.map((item) => item.role))).sort(), [initialArticles]);
  const items = useMemo(() => {
    let data = [...initialArticles];
    if (role) data = data.filter((item) => item.role === role);
    if (query.trim()) {
      const q = query.toLowerCase();
      data = data.filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(q));
    }
    return data;
  }, [initialArticles, role, query]);

  return (
    <div className="section-stack">
      <section className="section-card-tight">
        <div className="section-title">Поиск playbook</div>
        <div className="mobile-two-grid" style={{ marginTop: 12 }}>
          <label className="field-block">
            <span>Роль</span>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">Все роли</option>
              {roles.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="field-block">
            <span>Поиск</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Название или summary" />
          </label>
        </div>
      </section>

      <section className="section-card-tight">
        <div className="section-title">Материалы</div>
        <div className="section-stack" style={{ marginTop: 12 }}>
          {items.map((article) => (
            <Link key={article.id} href={`/knowledge/${article.id}`} className="list-row linkable" style={{ alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 700 }}>{article.title}</div>
                <div className="muted small" style={{ marginTop: 4 }}>{article.summary}</div>
                <div className="muted tiny" style={{ marginTop: 6 }}>{article.role} · calculators {article.calculators.length} · linked modules {article.linkedModules.length}</div>
              </div>
              <span className="mini-chip">{article.role}</span>
            </Link>
          ))}
          {!items.length ? <div className="muted small">Материалы под фильтр не найдены.</div> : null}
        </div>
      </section>
    </div>
  );
}
