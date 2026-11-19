'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { SESSION_COOKIE } from '@/lib/auth-cookies';
import type { GektaLocale } from '@/lib/gekta/content';
import { createWorkspaceId, GEKTA_SESSION_CHANGED, restoreGektaSessionMarker } from '@/lib/gekta/server-workspace';

export type GektaDraft = { id: string; text: string; previous?: string; projectId: string | null };
type DraftBook = { active: string; rows: GektaDraft[] };
const PREFIX = 'gekta-tab-drafts-v1:';
const EMPTY: DraftBook = { active: 'draft-home', rows: [] };
const MAX_DRAFTS = 60;

export function isNewGektaDraft(id: string) { return id.startsWith('draft-'); }

function freshId() {
  return createWorkspaceId('draft');
}

// This presentation cookie only partitions tab-local text. Account access is decided by the server.
export function currentGektaOwner(): string | null {
  if (typeof document === 'undefined') return 'guest';
  try {
    const marker = document.cookie.split('; ').find((part) => part.startsWith(SESSION_COOKIE + '='));
    if (!marker) return 'guest';
    const parsed = JSON.parse(decodeURIComponent(marker.slice(SESSION_COOKIE.length + 1)));
    return typeof parsed.email === 'string' && parsed.email ? 'account:' + parsed.email.trim().toLowerCase() : null;
  } catch { return null; }
}

function ownerKey(locale: GektaLocale, owner: string): string {
  return PREFIX + locale + ':' + encodeURIComponent(owner);
}

function hasAccountDraft(locale: GektaLocale): boolean {
  try {
    const legacy = sessionStorage.getItem(PREFIX + locale);
    return Object.keys(sessionStorage).some(key => key.startsWith(ownerKey(locale, 'account:')))
      || (legacy !== null && String(JSON.parse(legacy)?.owner).startsWith('account:'));
  } catch { return false; }
}

function readBook(locale: GektaLocale, owner: string | null): DraftBook {
  if (owner === null) return EMPTY;
  try {
    const key = ownerKey(locale, owner);
    const scoped = sessionStorage.getItem(key);
    const saved = JSON.parse(scoped ?? sessionStorage.getItem(PREFIX + locale) ?? 'null');
    if (saved?.owner !== owner || !Array.isArray(saved.rows)) return EMPTY;
    if (scoped === null) {
      try {
        sessionStorage.setItem(key, JSON.stringify(saved));
        sessionStorage.removeItem(PREFIX + locale);
      } catch { /* Leave the original intact if this tab cannot write. */ }
    }
    const rows: GektaDraft[] = saved.rows.slice(0, MAX_DRAFTS).flatMap((row: GektaDraft) =>
      row && typeof row.id === 'string' && typeof row.text === 'string' && row.text.length > 0
        ? [{ id: row.id, text: row.text.slice(0, 1200), projectId: typeof row.projectId === 'string' ? row.projectId : null,
          ...(typeof row.previous === 'string' ? { previous: row.previous.slice(0, 1200) } : {}) }] : []);
    return { active: typeof saved.active === 'string' ? saved.active : EMPTY.active, rows };
  } catch { return EMPTY; }
}

export function clearGektaTabDrafts() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(PREFIX)) sessionStorage.removeItem(key);
    }
  } catch {}
}

// A tab can return with another user's cookies while still displaying the previous editor.
export function useGektaWorkspaceOwner(locale: GektaLocale): string | null {
  const [owner, setOwner] = useState(currentGektaOwner);
  useLayoutEffect(() => {
    let mounted = true;
    let observed = currentGektaOwner();
    let pending = false;
    const observe = () => {
      const next = currentGektaOwner();
      const changed = observed !== next;
      observed = next;
      if (mounted) setOwner(next);
      return changed;
    };
    const recover = () => {
      if (pending || observed !== 'guest') return;
      pending = true;
      void restoreGektaSessionMarker().catch(() => false).finally(() => {
        pending = false;
        if (mounted) observe();
      });
    };
    const resume = () => {
      const previous = observed;
      observe();
      if (previous?.startsWith('account:') || hasAccountDraft(locale)) recover();
    };
    const beforeInteraction = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest('#gekta-chat')) return;
      const previous = observed;
      if (!observe()) return;
      // The event targets a DOM node rendered for the previous owner.
      event.preventDefault();
      event.stopImmediatePropagation();
      if (previous?.startsWith('account:')) recover();
    };
    const onVisible = () => { if (document.visibilityState === 'visible') resume(); };
    const events = ['pointerdown', 'keydown', 'beforeinput', 'input', 'change', 'click', 'submit', 'drop'];
    resume();
    window.addEventListener('pageshow', resume);
    window.addEventListener('focus', resume);
    window.addEventListener(GEKTA_SESSION_CHANGED, resume);
    document.addEventListener('visibilitychange', onVisible);
    for (const name of events) document.addEventListener(name, beforeInteraction, true);
    return () => {
      mounted = false;
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('focus', resume);
      window.removeEventListener(GEKTA_SESSION_CHANGED, resume);
      document.removeEventListener('visibilitychange', onVisible);
      for (const name of events) document.removeEventListener(name, beforeInteraction, true);
    };
  }, [locale]);
  return owner;
}

export function useGektaDrafts(locale: GektaLocale, activeId: string | null, projectId: string | null, owner: string | null) {
  const [book, setBook] = useState<DraftBook>(EMPTY);
  const current = useRef(EMPTY);
  const initialized = useRef(false);
  const initialize = useCallback(() => {
    if (!initialized.current) {
      current.current = readBook(locale, owner);
      initialized.current = true;
    }
    return current.current;
  }, [locale, owner]);
  const commit = useCallback((next: DraftBook) => {
    if (currentGektaOwner() !== owner) return;
    current.current = next;
    setBook(next);
    if (!owner) return;
    try {
      const key = ownerKey(locale, owner);
      if (next.rows.length) sessionStorage.setItem(key, JSON.stringify({ ...next, owner }));
      else sessionStorage.removeItem(key);
    } catch { /* The active tab still holds its in-memory draft. */ }
  }, [locale, owner]);
  useLayoutEffect(() => { setBook(initialize()); }, [initialize]);

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
