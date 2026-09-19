'use client';

import { FileText, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const STORAGE_KEY = 'platform-v7-header-notepad';

function useHeaderActionsMount() {
  const [mount, setMount] = useState<Element | null>(null);

  useEffect(() => {
    const sync = () => setMount(document.querySelector('.pc-v4-actions'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return mount;
}

function NotepadPanel({ note, setNote, onClose }: { note: string; setNote: (value: string) => void; onClose: () => void }) {
  const [savedAt, setSavedAt] = useState<string>('');

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, note);
      setSavedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setSavedAt('локально недоступно');
    }
  }, [note]);

  const clear = () => {
    setNote('');
  };

  return (
    <div className='p7-note-panel' role='dialog' aria-label='Блокнот'>
      <div className='p7-note-head'>
        <div>
          <strong>Блокнот</strong>
          <span>Личная быстрая заметка</span>
        </div>
        <button type='button' onClick={onClose} aria-label='Закрыть блокнот'><X size={15} /></button>
      </div>
      <textarea
        aria-label='Текст блокнота'
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder='Запиши телефон, вес, сумму, задачу или важную мысль по сделке.'
        spellCheck={false}
      />
      <div className='p7-note-foot'>
        <span>{note.length} знаков · {savedAt ? `сохранено ${savedAt}` : 'автосохранение'}</span>
        <button type='button' onClick={clear} disabled={!note.trim()} aria-label='Очистить блокнот'>
          <Trash2 size={14} />
          Очистить
        </button>
      </div>
    </div>
  );
}

export function NotepadHeaderWidget() {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const mount = useHeaderActionsMount();

  useEffect(() => {
    try {
      setNote(window.localStorage.getItem(STORAGE_KEY) ?? '');
    } catch {
      setNote('');
    }
  }, []);

  const widget = (
    <div className='p7-note-widget'>
      <style dangerouslySetInnerHTML={{ __html: `
        .p7-note-widget{position:relative;display:inline-flex!important;flex:0 0 auto!important}
        .p7-note-panel{position:absolute;right:0;top:50px;width:min(360px,calc(100dvw - 20px));padding:12px;border:1px solid var(--pc-border);border-radius:20px;background:var(--pc-bg-card);box-shadow:var(--pc-shadow-lg);z-index:521;display:grid;gap:10px;color:var(--pc-text-primary)}
        .p7-note-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.p7-note-head div{display:grid;gap:2px}.p7-note-head strong{font-size:14px;font-weight:950}.p7-note-head span{font-size:11px;color:var(--pc-text-muted);font-weight:800}.p7-note-head button{width:32px;height:32px;border-radius:12px;border:1px solid var(--pc-border);background:var(--pc-bg-elevated);color:var(--pc-text-secondary);display:inline-flex;align-items:center;justify-content:center}
        .p7-note-panel textarea{width:100%;min-height:210px;resize:vertical;border:1px solid var(--pc-border);border-radius:17px;background:var(--pc-bg-elevated);color:var(--pc-text-primary);padding:12px;font-size:14px;line-height:1.45;font-weight:650;outline:none}.p7-note-panel textarea:focus{border-color:var(--pc-accent);box-shadow:0 0 0 3px var(--pc-accent-bg)}.p7-note-panel textarea::placeholder{color:var(--pc-text-muted);font-weight:700}
        .p7-note-foot{display:flex;align-items:center;justify-content:space-between;gap:10px}.p7-note-foot span{font-size:11px;color:var(--pc-text-muted);font-weight:800}.p7-note-foot button{height:34px;padding:0 10px;border-radius:12px;border:1px solid var(--pc-border);background:var(--pc-bg-elevated);color:var(--pc-text-secondary);font-size:12px;font-weight:900;display:inline-flex;align-items:center;gap:6px}.p7-note-foot button:disabled{opacity:.45;cursor:not-allowed}.p7-note-foot button:not(:disabled):hover{border-color:var(--pc-border-light);color:var(--pc-text-primary)}
        @media(max-width:767px){.p7-note-widget .pc-v4-iconbtn{width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;border-radius:13px!important}.p7-note-panel{position:fixed;top:calc(env(safe-area-inset-top) + 58px);right:10px;left:10px;width:auto}.p7-note-panel textarea{min-height:240px}}
      ` }} />
      <button type='button' className='pc-v4-iconbtn' aria-label='Открыть блокнот' title='Блокнот' onClick={() => setOpen((value) => !value)}>
        <FileText size={18} strokeWidth={2.35} />
      </button>
      {open ? <NotepadPanel note={note} setNote={setNote} onClose={() => setOpen(false)} /> : null}
    </div>
  );

  return mount ? createPortal(widget, mount) : null;
}
