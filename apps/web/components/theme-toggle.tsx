'use client';

import { useTheme } from './theme-provider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === 'dark' ? 'Светлый режим' : 'Тёмный режим';

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={nextLabel}
      title={nextLabel}
    >
      <span className="theme-toggle-icon" aria-hidden="true">{theme === 'dark' ? '☀︎' : '☾'}</span>
      <span className="theme-toggle-text">{theme === 'dark' ? 'Светлый' : 'Тёмный'}</span>
      <span className="theme-toggle-state">{theme === 'dark' ? 'dark' : 'light'}</span>
    </button>
  );
}
