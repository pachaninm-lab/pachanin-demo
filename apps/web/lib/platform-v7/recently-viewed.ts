'use client';

export type RecentItemType = 'deal' | 'lot' | 'dispute' | 'document';

export interface RecentItem {
  id: string;
  type: RecentItemType;
  label: string;
  href: string;
  status?: string;
  viewedAt: number; // Date.now()
}

const STORAGE_KEY = 'pf_recently_viewed';
const MAX_ITEMS = 5;

export function trackRecentItem(item: Omit<RecentItem, 'viewedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const items = getRecentItems();
    const filtered = items.filter((i) => i.id !== item.id || i.type !== item.type);
    const updated: RecentItem[] = [{ ...item, viewedAt: Date.now() }, ...filtered].slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage may be unavailable
  }
}

export function getRecentItems(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function clearRecentItems(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
