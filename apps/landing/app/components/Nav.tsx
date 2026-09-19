'use client';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';

const links = [
  { label: 'Платформа', href: '#features' },
  { label: 'Как работает', href: '#how-it-works' },
  { label: 'Участники', href: '#roles' },
  { label: 'Интеграции', href: '#integrations' },
];

export default function Nav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <div
        className="border-b border-[rgba(126,242,196,0.08)]"
        style={{ background: 'rgba(3,13,10,0.85)', backdropFilter: 'blur(16px)' }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center glow-sm">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 13L8 3L13 13" stroke="#7EF2C4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 9.5H11" stroke="#7EF2C4" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <span className="font-bold text-[15px] text-white tracking-tight">
              Прозрачная<span className="text-mint"> Цена</span>
            </span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-sm text-[#8BA89E] hover:text-white transition-colors"
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="#cta"
              className="text-sm text-[#8BA89E] hover:text-white transition-colors px-4 py-2"
            >
              Войти
            </a>
            <a
              href="#cta"
              className="text-sm font-semibold px-5 py-2 rounded-lg bg-brand hover:bg-brand-hover text-white transition-colors"
            >
              Запросить демо
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden text-[#8BA89E] hover:text-white"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div
          className="md:hidden border-b border-[rgba(126,242,196,0.08)]"
          style={{ background: 'rgba(3,13,10,0.95)', backdropFilter: 'blur(16px)' }}
        >
          <div className="px-6 py-4 flex flex-col gap-4">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-sm text-[#8BA89E] hover:text-white transition-colors py-1"
              >
                {l.label}
              </a>
            ))}
            <a
              href="#cta"
              onClick={() => setOpen(false)}
              className="text-sm font-semibold px-5 py-2.5 rounded-lg bg-brand text-white text-center mt-2"
            >
              Запросить демо
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
