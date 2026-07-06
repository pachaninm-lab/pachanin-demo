'use client';

import * as React from 'react';

const VERSION = '2026-07-06-v7-shell-stable';
const VERSION_KEY = 'pc-v7-runtime-version';

async function clearOldRuntimeState() {
  try {
    const previous = window.localStorage.getItem(VERSION_KEY);
    if (previous === VERSION) return;
    window.localStorage.setItem(VERSION_KEY, VERSION);
  } catch {}

  try {
    if ('caches' in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  } catch {}

  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((reg) => reg.unregister()));
    }
  } catch {}
}

export function V7CacheGuard() {
  React.useEffect(() => {
    clearOldRuntimeState();
  }, []);

  return null;
}
