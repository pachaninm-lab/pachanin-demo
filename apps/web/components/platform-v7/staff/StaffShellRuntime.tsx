'use client';

import { useEffect } from 'react';

const ROOT_CLASS = 'pc-staff-control-plane-active';

export function StaffShellRuntime() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add(ROOT_CLASS);
    return () => root.classList.remove(ROOT_CLASS);
  }, []);

  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}

const css = `
html.${ROOT_CLASS},
html.${ROOT_CLASS} body {
  width: 100%;
  max-width: 100%;
  min-height: 100%;
  margin: 0;
  overflow-x: hidden;
  background: #f7faf8;
}
html.${ROOT_CLASS} .p7-support-chat-button,
html.${ROOT_CLASS} .p7-support-chat-panel,
html.${ROOT_CLASS} .pc-v4-bottomnav,
html.${ROOT_CLASS} .pc-v4-mobile-rail,
html.${ROOT_CLASS} .pc-role-assistant,
html.${ROOT_CLASS} .p7-onboarding-tour {
  display: none !important;
}
html.${ROOT_CLASS} body > [data-radix-portal] {
  max-width: 100vw;
}
html.${ROOT_CLASS} [data-staff-platform-shell] a[class*="primaryButton"] {
  color: #ffffff !important;
}
`;
