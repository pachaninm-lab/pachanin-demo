'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { SESSION_COOKIE } from '@/lib/auth-cookies';
import type { GektaLocale } from '@/lib/gekta/content';

export type GektaDraft = { id: string; text: string; previous?: string; projectId: string | null };
type DraftBook = { active: string; rows: GektaDraft[] };
const PREFIX = 'gekta-tab-drafts-v1:';
const EMPTY: DraftBook = { active: 'draft-home', rows: [] };
const MAX_DRAFTS = 60;

export function isNewGektaDraft(id: string) { return id.startsWith('draft-'); }

function freshId() {
  return 'draft-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));
}

// This presentation cookie only partitions tab-local text. Account access is decided by the server.
function browserOwner(): string | null {
  try {
    const marker = document.cookie.split('; ').find((part) => part.startsWith(SESSION_COOKIE + '='));
    if (!marker) return 'guest';
    const parsed = JSON.parse(decodeURIComponent(marker.slice(SESSION_COOKIE.length + 1)));
    return typeof parsed.email === 'string' && parsed.email ? 'account:' + parsed.email.trim().toLowerCase() : null;
  } catch { return null; }
}

function readBook(locale: GektaLocale, owner: string | null): DraftBook {
  if (owner === null) return EMPTY;
  try {
    const saved = JSON.parse(sessionStorage.getItem(PREFIX + locale) || 'null');
    if (saved?.owner !== owner || !Array.isArray(saved.rows)) return EMPTY;
    const rows: GektaDraft[] = saved.rows.slice(0, MAX_DRAFTS).flatMap((row: GektaDraft) =>
      row && typeof row.id === 'string' && typeof row.text === 'string' && row.text.length > 0
        ? [{ id: row.id, text: row.text.slice(0, 1200), projectId: typeof row.projectId === 'string' ? row.projectId : null,
          ...(typeof row.previous === 'string' ? { previous: row.previous.slice(0, 1200) } : {}) }] : []);
    return { active: typeof saved.active === 'string' ? saved.active : EMPTY.active, rows };
  } catch { return EMPTY; }
}

export function clearGektaTabDrafts() {
  try { for (const locale of ['ru', 'en', 'zh']) sessionStorage.removeItem(PREFIX + locale); } catch {}
}

export function useGektaDrafts(locale: GektaLocale, activeId: string | null, projectId: string | null) {
  const [book, setBook] = useState<DraftBook>(EMPTY);
  const current = useRef(EMPTY);
  const scope = useRef<{ locale: GektaLocale; owner: string | null } | null>(null);
  const initialize = useCallback(() => {
    const owner = browserOwner();
    if (scope.current?.locale !== locale || scope.current.owner !== owner) {
      current.current = readBook(locale, owner);
      scope.current = { locale, owner };
    }
    return current.current;
  }, [locale]);
  const commit = useCallback((next: DraftBook) => {
    current.current = next;
    setBook(next);
    const owner = scope.current?.owner;
    try {
      if (owner && browserOwner() === owner && next.rows.length) sessionStorage.setItem(PREFIX + locale, JSON.stringify({ ...next, owner }));
      else sessionStorage.removeItem(PREFIX + locale);
    } catch { /* The active tab still holds its in-memory draft. */ }
  }, [locale]);
  useLayoutEffect(() => {
    const sync = () => setBook(initialize());
    sync();
    window.addEventListener('pageshow', sync);
    window.addEventListener('focus', sync);
    return () => { window.removeEventListener('pageshow', sync); window.removeEventListener('focus', sync); };
  }, [initialize]);

  const write = useCallback((text: string, replacing = false) => {
    const source = initialize();
    // Text entered before a saved conversation has loaded belongs to a new question.
    const id = !activeId && !isNewGektaDraft(source.active) ? freshId() : source.active;
    const old = source.rows.find((row) => row.id === id);
    if (old?.text === text) return;
    const rows = source.rows.filter((row) => row.id !== id);
    if (text) rows.unshift({ id, text: text.slice(0, 1200), projectId, ...(replacing && old?.text ? { previous: old.previous ?? old.text } : {}) });
    commit({ active: id, rows: rows.slice(0, MAX_DRAFTS) });
  }, [activeId, commit, initialize, projectId]);
  const setText = useCallback((text: string) => write(text), [write]);
  const replace = useCallback((text: string) => write(text, true), [write]);
  const undo = useCallback(() => {
    const source = initialize();
    const previous = source.rows.find((row) => row.id === source.active)?.previous;
    if (previous !== undefined) write(previous);
  }, [initialize, write]);
  const select = useCallback((id?: string) => {
    const source = initialize();
    commit({ ...source, active: id ?? freshId() });
  }, [commit, initialize]);
  const remove = useCallback((id: string) => {
    const source = initialize();
    commit({ active: source.active === id ? freshId() : source.active, rows: source.rows.filter((row) => row.id !== id) });
  }, [commit, initialize]);
  const clear = useCallback(() => { initialize(); commit(EMPTY); }, [commit, initialize]);
  const reassignProject = useCallback((from: string, to: string | null) => {
    const source = initialize();
    if (source.rows.some(row => row.projectId === from)) {
      commit({ ...source, rows: source.rows.map(row => row.projectId === from ? { ...row, projectId: to } : row) });
    }
  }, [commit, initialize]);
  const move = useCallback((from: string, to: string, sentText?: string) => {
    const source = initialize();
    const old = source.rows.find((row) => row.id === from);
    const remaining = source.rows.filter((row) => row.id !== from);
    if (old && (sentText === undefined || old.text.trim() !== sentText.trim())) {
      // The author may already be typing the following question while access is checked.
      if (!remaining.some((row) => row.id === to)) remaining.unshift({ ...old, id: to });
    }
    commit({ active: source.active === from ? to : source.active, rows: remaining });
  }, [commit, initialize]);
  const row = (activeId || isNewGektaDraft(book.active)) ? book.rows.find((item) => item.id === book.active) : undefined;
  return { book, value: row?.text ?? '', canUndo: row?.previous !== undefined, setText, replace, undo, select, remove, clear, move, reassignProject };
}
