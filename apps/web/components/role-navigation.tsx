'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../lib/api';
import { getNavigationGroups, getVisibleSurfaces, isSurfaceActive, normalizeSurfaceRole, ROLE_LABELS, type RoleKey } from '../lib/surface-registry';
import { isPrivilegedSurfaceRole } from '../../../shared/role-contract';

type Me = { role?: string; orgName?: string; fullName?: string; surfaceRole?: string };

export function RoleNavigation() {
  const pathname = usePathname() || '/';
  const [me, setMe] = useState<Me | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [showInternal, setShowInternal] = useState(false);
  const internalPreviewEnabled = String(process.env.NEXT_PUBLIC_ENABLE_INTERNAL_PREVIEW || 'false').toLowerCase() === 'true';

  useEffect(() => {
    fetchJson<Me>('/auth/me', { retryOn401: false })
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  const role = normalizeSurfaceRole(me?.surfaceRole || me?.role || 'GUEST') as RoleKey;
  const isPrivileged = isPrivilegedSurfaceRole(role);
  const groups = useMemo(() => getNavigationGroups(role, { includeInternalPreview: isPrivileged && internalPreviewEnabled && showInternal }), [role, isPrivileged, internalPreviewEnabled, showInternal]);
  const secondary = useMemo(() => {
    const primaryHrefs = new Set(groups.flatMap((group) => group.items.filter((item) => item.weight === 'primary').map((item) => item.href)));
    return getVisibleSurfaces(role, { includeInternalPreview: isPrivileged && internalPreviewEnabled && showInternal })
      .filter((item) => !primaryHrefs.has(item.href))
      .slice(0, 8);
  }, [groups, role, isPrivileged, internalPreviewEnabled, showInternal]);

  const statusText = useMemo(() => {
    if (role === 'GUEST') return 'Сначала вход и допуск, потом role-first workspace.';
    return `${ROLE_LABELS[role]}${me?.orgName ? ` · ${me.orgName}` : ''}`;
  }, [role, me?.orgName]);

  return (
    <section className="role-nav-shell border rounded-[20px] p-3 md:p-4 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="eyebrow">Навигация по роли</div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-soft)' }}>{statusText}</div>
        </div>
        <div className="toolbar-row toolbar-row-right">
          {isPrivileged && internalPreviewEnabled ? (
            <label className="nav-toggle-chip cursor-pointer">
              <input type="checkbox" checked={showInternal} onChange={(e) => setShowInternal(e.target.checked)} />
              <span>internal / demo</span>
            </label>
          ) : null}
          <button type="button" className="button ghost compact" onClick={() => setExpanded((v) => !v)}>
            {expanded ? 'Скрыть вторичные разделы' : 'Показать вторичные разделы'}
          </button>
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.title} className="section-card-tight">
          <div className="eyebrow" style={{ marginBottom: 10 }}>{group.title}</div>
          <div className="nav-chip-row">
            {group.items.map((item) => (
              <Link key={item.href} href={item.href} className={`nav-chip ${isSurfaceActive(pathname, item.href) ? 'active' : 'muted'}`}>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {expanded && secondary.length > 0 ? (
        <div className="section-card-tight">
          <div className="eyebrow" style={{ marginBottom: 10 }}>Вторичные разделы</div>
          <div className="nav-chip-row">
            {secondary.map((item) => (
              <Link key={item.href} href={item.href} className={`nav-chip ${isSurfaceActive(pathname, item.href) ? 'active' : 'muted'}`}>
                <span>{item.label}</span>
                {item.audience === 'internal' ? <span className="text-[10px] uppercase opacity-80">internal</span> : null}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
