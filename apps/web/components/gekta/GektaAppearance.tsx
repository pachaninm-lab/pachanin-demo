'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { GektaLocale } from '@/lib/gekta/content';
import { GEKTA_THEME_COLORS, GEKTA_THEME_STORAGE, type GektaTheme, type GektaThemePreference } from '@/lib/gekta/appearance';
import styles from './GektaWorkspace.module.css';

const Appearance = createContext<{
  theme: GektaTheme;
  preference: GektaThemePreference;
  selectTheme: (value: GektaThemePreference) => void;
} | null>(null);
const SYSTEM_THEME = '(prefers-color-scheme: dark)';
const THEME_LABELS = {
  ru: { light: 'Включить светлую тему', dark: 'Включить тёмную тему' },
  en: { light: 'Switch to light theme', dark: 'Switch to dark theme' },
  zh: { light: '切换到浅色主题', dark: '切换到深色主题' },
} as const;
const THEME_OPTIONS = {
  ru: { label: 'Внешний вид', system: 'Как на устройстве', light: 'Светлая', dark: 'Тёмная' },
  en: { label: 'Appearance', system: 'Device', light: 'Light', dark: 'Dark' },
  zh: { label: '外观', system: '跟随设备', light: '浅色', dark: '深色' },
} as const;
const THEME_ICONS = { system: Monitor, light: Sun, dark: Moon };

function readPreference(): GektaThemePreference {
  try {
    const value = localStorage.getItem(GEKTA_THEME_STORAGE);
    if (value === 'light' || value === 'dark') return value;
  } catch {}
  return 'system';
}

export function GektaAppearance({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<GektaTheme>('light');
  const [preference, setPreference] = useState<GektaThemePreference>('system');
  const preferenceRef = useRef<GektaThemePreference>('system');

  useEffect(() => {
    const system = window.matchMedia?.(SYSTEM_THEME);
    const root = document.documentElement;
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousColor = themeMeta?.content;
    const sync = () => {
      const value = preferenceRef.current;
      const next = value === 'system' ? (system?.matches ? 'dark' : 'light') : value;
      root.dataset.gektaTheme = next;
      setTheme(next);
      setPreference(value);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== GEKTA_THEME_STORAGE && event.key !== null) return;
      preferenceRef.current = readPreference();
      sync();
    };
    preferenceRef.current = readPreference();
    sync();
    system?.addEventListener('change', sync);
    window.addEventListener('storage', onStorage);
    return () => {
      system?.removeEventListener('change', sync);
      window.removeEventListener('storage', onStorage);
      if (themeMeta && themeMeta.content === GEKTA_THEME_COLORS[root.dataset.gektaTheme as GektaTheme]) {
        themeMeta.content = previousColor ?? GEKTA_THEME_COLORS.light;
      }
      delete root.dataset.gektaTheme;
    };
  }, []);

  useEffect(() => {
    // Read the resolved theme from the root to agree with the first-paint script.
    const actual = document.documentElement.dataset.gektaTheme;
    const themeMeta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (themeMeta && (actual === 'light' || actual === 'dark')) themeMeta.content = GEKTA_THEME_COLORS[actual];
  }, [theme]);

  const selectTheme = (value: GektaThemePreference) => {
    const next = value === 'system' ? (window.matchMedia?.(SYSTEM_THEME)?.matches ? 'dark' : 'light') : value;
    preferenceRef.current = value;
    setPreference(value);
    document.documentElement.dataset.gektaTheme = next;
    setTheme(next);
    try {
      if (value === 'system') localStorage.removeItem(GEKTA_THEME_STORAGE);
      else localStorage.setItem(GEKTA_THEME_STORAGE, value);
    } catch {}
  };

  return (
    <Appearance.Provider value={{ theme, preference, selectTheme }}>
      <div className={styles.surface}>{children}</div>
    </Appearance.Provider>
  );
}

export function GektaThemeToggle({ locale }: { locale: GektaLocale }) {
  const appearance = useContext(Appearance);
  if (!appearance) return null;
  const next = appearance.theme === 'dark' ? 'light' : 'dark';
  const Icon = next === 'dark' ? Moon : Sun;
  const label = THEME_LABELS[locale][next];
  return (
    <button type='button' className={styles.iconButton} onClick={() => appearance.selectTheme(next)} aria-label={label} title={label}>
      <Icon size={18} aria-hidden='true' />
    </button>
  );
}

export function GektaThemeOptions({ locale }: { locale: GektaLocale }) {
  const appearance = useContext(Appearance);
  if (!appearance) return null;
  const copy = THEME_OPTIONS[locale];
  return (
    <fieldset className='m-0 mt-3 min-w-0 border-0 p-0'>
      <legend className='text-sm font-semibold text-slate-900'>{copy.label}</legend>
      <div className='mt-2 grid grid-cols-3 gap-1.5 rounded-2xl bg-slate-100 p-1.5'>
        {(['system', 'light', 'dark'] as const).map((mode) => {
          const Icon = THEME_ICONS[mode];
          return (
            <label key={mode} className='min-w-0 cursor-pointer'>
              <input type='radio' name='gekta-theme' className='sr-only' checked={appearance.preference === mode} onChange={() => appearance.selectTheme(mode)} />
              <span className={styles.themeChoice}><Icon size={16} aria-hidden='true' />{copy[mode]}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
