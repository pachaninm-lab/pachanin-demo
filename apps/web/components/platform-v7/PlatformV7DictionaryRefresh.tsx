'use client';

import * as React from 'react';

const MARK_KEY = 'pc-v7-dictionary-refresh-20260705-v1';
const LAST_CHECK_KEY = 'pc-v7-translation-dictionaries-last-check-v3';

export function PlatformV7DictionaryRefresh() {
  React.useLayoutEffect(() => {
    try {
      if (window.localStorage.getItem(MARK_KEY) === 'done') return;
      window.localStorage.setItem(LAST_CHECK_KEY, '0');
      window.localStorage.setItem(MARK_KEY, 'done');
    } catch {}
  }, []);

  return null;
}
