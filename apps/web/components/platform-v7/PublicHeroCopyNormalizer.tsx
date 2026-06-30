'use client';

import * as React from 'react';

function setLastText(link: HTMLElement | null, value: string) {
  if (!link) return;
  const nodes = Array.from(link.childNodes);
  const textNode = nodes.reverse().find((node) => node.nodeType === Node.TEXT_NODE);
  if (textNode) {
    textNode.textContent = value;
    return;
  }
  link.append(document.createTextNode(value));
}

function applyCopy() {
  document.querySelectorAll<HTMLAnchorElement>('.pc-v7-public-entry .entry-nav a').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (href === '#process') link.textContent = 'Порядок сделки';
    if (href === '/platform-v7/demo') link.textContent = 'Демонстрация';
    if (href === '/platform-v7/contact') link.textContent = 'Обращение';
  });

  setLastText(document.querySelector<HTMLElement>('.pc-v7-public-entry .entry-secondary-cta'), 'Демонстрационная сделка');

  const contact = document.querySelector<HTMLAnchorElement>('.pc-v7-public-entry .entry-register-cta');
  if (contact) {
    contact.setAttribute('href', '/platform-v7/contact');
    setLastText(contact, 'Направить обращение');
  }
}

export function PublicHeroCopyNormalizer() {
  React.useEffect(() => {
    applyCopy();
    const timers = [80, 220, 600, 1200].map((delay) => window.setTimeout(applyCopy, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, []);

  return null;
}
