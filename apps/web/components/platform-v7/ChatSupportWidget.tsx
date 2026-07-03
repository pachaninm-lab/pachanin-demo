'use client';

import Link from 'next/link';
import { MessageCircle } from 'lucide-react';

export function ChatSupportWidget() {
  return (
    <>
      <Link className='p7-support-entry' href='/platform-v7/contact' aria-label='Направить обращение в поддержку'>
        <MessageCircle size={22} strokeWidth={2.35} />
        <span>Поддержка</span>
      </Link>
      <style>{css}</style>
    </>
  );
}

const css = `
.p7-support-entry{position:fixed;right:18px;bottom:calc(env(safe-area-inset-bottom,0px) + 22px);z-index:1150;min-height:52px;padding:0 16px;border-radius:18px;background:#087a3b;color:#fff;text-decoration:none;box-shadow:0 18px 42px rgba(0,122,47,.26);display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:950}.p7-support-entry span{display:inline-block}@media(max-width:720px){.p7-support-entry{right:14px;bottom:calc(env(safe-area-inset-bottom,0px) + 118px);width:54px;height:54px;min-height:54px;padding:0;border-radius:19px}.p7-support-entry span{display:none}}
`;
