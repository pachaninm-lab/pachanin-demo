'use client';

import { useEffect, useState } from 'react';

export default function StickyCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const threshold = Math.min(560, window.innerHeight * 0.7);
      setVisible(window.scrollY > threshold);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={`fixed inset-x-3 bottom-3 z-50 md:hidden transition duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      }`}
      aria-hidden={!visible}
    >
      <div className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-[rgba(126,242,196,0.16)] bg-[#07110E]/95 p-2 shadow-[0_22px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <a href="#interest" className="lux-button rounded-xl bg-brand px-4 py-3 text-center text-sm font-bold text-white">Пройти мини-чат</a>
        <a href="tel:+79162778989" className="rounded-xl border border-[rgba(126,242,196,0.14)] px-4 py-3 text-center text-sm font-bold text-[#C9D8D2]">Звонок</a>
      </div>
    </div>
  );
}
