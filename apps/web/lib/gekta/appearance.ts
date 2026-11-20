export const GEKTA_THEME_STORAGE = 'gekta-theme-v1';
export const GEKTA_THEME_COLORS = { light: '#f7f8f3', dark: '#141c17' } as const;

export type GektaTheme = keyof typeof GEKTA_THEME_COLORS;
export type GektaThemePreference = GektaTheme | 'system';

// Run before the workspace is painted, including on a reload or installed launch.
export const GEKTA_THEME_BOOTSTRAP = `(() => {
  let saved;
  try { saved = localStorage.getItem('${GEKTA_THEME_STORAGE}'); } catch {}
  const theme = saved === 'light' || saved === 'dark'
    ? saved
    : matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.gektaTheme = theme;
})();`;
