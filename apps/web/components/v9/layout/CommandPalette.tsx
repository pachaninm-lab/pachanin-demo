'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Search, FileText, LayoutDashboard, Scale, Landmark, Wheat, ShoppingCart, MapPin, X } from 'lucide-react';
import { cn } from '@/lib/v9/utils';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  href: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: React.ComponentType<any>;
  category: string;
  keywords?: string[];
}

const staticItems: CommandItem[] = [
  { id: 'ct', label: 'Control Tower', description: 'Обзор всех сделок', href: '/platform-v7/control-tower', icon: LayoutDashboard, category: 'Навигация', keywords: ['дашборд', 'обзор', 'оператор'] },
  { id: 'deals', label: 'Сделки', description: 'Все активные сделки', href: '/platform-v7/deals', icon: FileText, category: 'Навигация', keywords: ['список', 'таблица'] },
  { id: 'disputes', label: 'Споры', description: 'War-room', href: '/platform-v7/disputes', icon: Scale, category: 'Навигация', keywords: ['конфликт', 'арбитраж'] },
  { id: 'bank', label: 'Банк', description: 'Reserve / Hold / Release', href: '/platform-v7/bank', icon: Landmark, category: 'Навигация', keywords: ['сбер', 'деньги', 'резерв'] },
  { id: 'seller', label: 'Продавец', description: 'Воркспейс продавца', href: '/platform-v7/seller', icon: Wheat, category: 'Роли' },
  { id: 'buyer', label: 'Покупатель', description: 'Воркспейс покупателя', href: '/platform-v7/buyer', icon: ShoppingCart, category: 'Роли' },
  { id: 'field', label: 'Поле', description: 'Водитель / Элеватор', href: '/platform-v7/field', icon: MapPin, category: 'Роли', keywords: ['водитель', 'офлайн'] },
  // Quick deals
  { id: 'dl9102', label: 'DL-9102', description: 'Пшеница 4 кл. · Спор DK-2024-89', href: '/platform-v7/deals/DL-9102', icon: FileText, category: 'Быстрый доступ', keywords: ['ковалёв', 'агроинвест', 'спор'] },
  { id: 'dl9103', label: 'DL-9103', description: 'Кукуруза 3 кл. · В пути', href: '/platform-v7/deals/DL-9103', icon: FileText, category: 'Быстрый доступ' },
  { id: 'dk8924-89', label: 'DK-2024-89', description: 'Спор · Несоответствие качества', href: '/platform-v7/disputes/DK-2024-89', icon: Scale, category: 'Быстрый доступ', keywords: ['hold', '624'] },
];

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = React.useState('');
  const [selectedIdx, setSelectedIdx] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  const filtered = query.trim()
    ? staticItems.filter(item =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.description?.toLowerCase().includes(query.toLowerCase()) ||
        item.keywords?.some(k => k.includes(query.toLowerCase()))
      )
    : staticItems;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, item) => {
    (acc[item.category] ??= []).push(item);
    return acc;
  }, {});

  const flat = Object.values(grouped).flat();

  React.useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function navigate(href: string) {
    router.push(href);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, flat.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && flat[selectedIdx]) navigate(flat[selectedIdx].href);
    if (e.key === 'Escape') onClose();
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(15,20,25,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 'clamp(60px, 15vh, 120px)',
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Командная панель"
    >
      <div
        style={{
          width: '100%', maxWidth: 560, background: '#fff',
          borderRadius: 12, boxShadow: '0 20px 60px rgba(9,30,66,0.25)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderBottom: '1px solid #E4E6EA' }}>
          <Search size={16} color="#6B778C" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Поиск по сделкам, разделам, ролям..."
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#0F1419',
              background: 'transparent', fontFamily: 'Inter, sans-serif',
            }}
            aria-label="Поиск"
            aria-autocomplete="list"
          />
          <button onClick={onClose} style={{ color: '#6B778C', background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 4 }} aria-label="Закрыть">
            <X size={14} />
          </button>
          <kbd style={{ fontSize: 10, padding: '2px 5px', background: '#F4F5F7', border: '1px solid #E4E6EA', borderRadius: 4, color: '#6B778C', fontFamily: 'monospace' }}>
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 360, overflowY: 'auto' }} role="listbox">
          {filtered.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6B778C', fontSize: 13 }}>
              Ничего не найдено по запросу «{query}»
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div style={{ padding: '8px 16px 4px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6B778C' }}>
                  {category}
                </div>
                {items.map(item => {
                  const globalIdx = flat.indexOf(item);
                  const isSelected = globalIdx === selectedIdx;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => navigate(item.href)}
                      onMouseEnter={() => setSelectedIdx(globalIdx)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 16px', border: 'none', cursor: 'pointer', textAlign: 'left',
                        background: isSelected ? 'rgba(10,122,95,0.06)' : 'transparent',
                        transition: 'background 0.1s',
                      }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: isSelected ? 'rgba(10,122,95,0.12)' : '#F4F5F7',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Icon size={14} color={isSelected ? '#0A7A5F' : '#6B778C'} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: isSelected ? '#0A7A5F' : '#0F1419' }}>
                          {item.label}
                        </div>
                        {item.description && (
                          <div style={{ fontSize: 11, color: '#6B778C', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.description}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <kbd style={{ fontSize: 10, padding: '2px 5px', background: '#F4F5F7', border: '1px solid #E4E6EA', borderRadius: 4, color: '#6B778C', fontFamily: 'monospace' }}>
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid #E4E6EA', display: 'flex', gap: 12, fontSize: 10, color: '#6B778C' }}>
          <span><kbd style={{ fontFamily: 'monospace' }}>↑↓</kbd> навигация</span>
          <span><kbd style={{ fontFamily: 'monospace' }}>↵</kbd> открыть</span>
          <span><kbd style={{ fontFamily: 'monospace' }}>Esc</kbd> закрыть</span>
        </div>
      </div>
    </div>
  );
}
