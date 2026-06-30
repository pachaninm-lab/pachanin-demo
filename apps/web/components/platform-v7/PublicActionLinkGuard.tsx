'use client';

import * as React from 'react';

const LINKS = [
  ['.entry-action-card-contact a', '/platform-v7/contact'],
  ['.entry-action-card-review a', '/platform-v7/request'],
  ['.entry-action-card-register a', '/platform-v7/register'],
] as const;

function restoreLinks() {
  LINKS.forEach(([selector, href]) => {
    document.querySelectorAll<HTMLAnchorElement>(selector).forEach((link) => {
      link.href = href;
      link.setAttribute('href', href);
      link.dataset.publicActionHref = href;
    });
  });
}

export function PublicActionLinkGuard() {
  React.useEffect(() => {
    restoreLinks();
    const timers = [60, 160, 320, 720, 1300, 2200].map((delay) => window.setTimeout(restoreLinks, delay));
    const observer = new MutationObserver(restoreLinks);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
    };
  }, []);

  return null;
}
