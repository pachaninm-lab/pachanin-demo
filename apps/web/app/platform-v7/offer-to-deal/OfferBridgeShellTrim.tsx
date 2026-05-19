'use client';

import * as React from 'react';

export function OfferBridgeShellTrim() {
  React.useEffect(() => {
    const note = document.querySelector('.pc-v4-pilot-note');
    if (note?.textContent?.includes('Подключения и банковские события')) {
      note.remove();
    }
  }, []);

  return null;
}
