'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

function normalize(pathname: string | null) {
  return (pathname || '').split('?')[0].replace(/\/$/, '') || '/platform-v7';
}

export function LoginHeaderExitButton() {
  const pathname = usePathname();
  const [mount, setMount] = useState<Element | null>(null);
  const isLogin = normalize(pathname) === '/platform-v7/login';

  useEffect(() => {
    if (!isLogin) {
      setMount(null);
      return;
    }
    const sync = () => setMount(document.querySelector('.login-top'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [isLogin]);

  if (!isLogin || !mount) return null;

  return createPortal(
    <>
      <style>{css}</style>
      <Link href='/platform-v7' className='p7-login-exit-button' aria-label='Выйти на главную'>
        <LogOut size={17} strokeWidth={2.4} />
        <span>Выход</span>
      </Link>
    </>,
    mount,
  );
}

const css = `
.login-top{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:12px!important;inline-size:100%!important}
.login-top>a:first-child{min-width:0!important}
.p7-login-exit-button{margin-left:auto!important;height:42px!important;padding:0 15px!important;border-radius:15px!important;border:1px solid rgba(185,28,28,.18)!important;background:rgba(185,28,28,.055)!important;color:#9f1d1d!important;font-size:13px!important;font-weight:950!important;letter-spacing:-.02em!important;text-decoration:none!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;box-shadow:0 10px 24px rgba(127,29,29,.08)!important;white-space:nowrap!important}
.p7-login-exit-button:active{transform:translateY(1px)!important}
@media(max-width:520px){.login-top>span{display:none!important}.p7-login-exit-button{height:40px!important;padding:0 12px!important;border-radius:14px!important}.p7-login-exit-button span{display:inline!important}}
`;
