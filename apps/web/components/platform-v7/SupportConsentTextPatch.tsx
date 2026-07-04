'use client';

import * as React from 'react';

const NOTE_TEXT = '\u041d\u0430\u0436\u0438\u043c\u0430\u044f \u00ab\u041e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c\u00bb, \u0432\u044b \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442\u0435 \u0441\u043e\u0433\u043b\u0430\u0441\u0438\u0435 \u043d\u0430 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0443 \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0445 \u0434\u0430\u043d\u043d\u044b\u0445 \u0434\u043b\u044f \u043e\u0442\u0432\u0435\u0442\u0430 \u043d\u0430 \u043e\u0431\u0440\u0430\u0449\u0435\u043d\u0438\u0435 \u0438 \u043f\u0440\u0438\u043d\u0438\u043c\u0430\u0435\u0442\u0435 \u0443\u0441\u043b\u043e\u0432\u0438\u044f ';
const LINK_TEXT = '\u043f\u043e\u043b\u0438\u0442\u0438\u043a\u0438 \u043a\u043e\u043d\u0444\u0438\u0434\u0435\u043d\u0446\u0438\u0430\u043b\u044c\u043d\u043e\u0441\u0442\u0438';

function applySupportConsentText() {
  document.querySelectorAll<HTMLElement>('.p7-support-chat-form small').forEach((node) => {
    if (node.dataset.p7ConsentPatched === 'yes') return;

    node.textContent = '';
    node.append(NOTE_TEXT);

    const link = document.createElement('a');
    link.href = '/platform-v7/privacy';
    link.textContent = LINK_TEXT;
    link.style.color = '#087a3b';
    link.style.fontWeight = '850';
    link.style.textDecoration = 'underline';
    link.style.textUnderlineOffset = '2px';
    node.append(link, '.');

    node.dataset.p7ConsentPatched = 'yes';
  });
}

export function SupportConsentTextPatch() {
  React.useEffect(() => {
    applySupportConsentText();
    const observer = new MutationObserver(applySupportConsentText);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
