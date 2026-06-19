'use client';

import { NotebookPen, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const STORAGE_KEY = 'pc-v7-notepad';

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

function readNote(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function NotepadPanel({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    setText(readNote());
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, text);
        setSavedAt(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
      } catch {
        /* localStorage unavailable — keep the note in memory only */
      }
    }, 300);
    return () => window.clearTimeout(id);
  }, [text]);

  const clear = () => {
    setText('');
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setSavedAt(null);
  };

  return (
    <div className='p7-note-panel' role='dialog' aria-label='Блокнот'>
      <div className='p7-note-head'>
        <strong>Блокнот</strong>
        <button type='button' onClick={onClose} aria-label='Закрыть блокнот'><X size={15} /></button>
      </div>
      <textarea
        className='p7-note-area'
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder='Рабочие заметки по сделке…'
        aria-label='Текст заметки'
        spellCheck={false}
      />
      <div className='p7-note-foot'>
        <span>{savedAt ? `Сохранено · ${savedAt}` : 'Локально, только в этом браузере'}</span>
        <button type='button' onClick={clear} aria-label='Очистить заметку'><Trash2 size={14} /> Очистить</button>
      </div>
    </div>
  );
}

export function NotepadHeaderWidget() {
  const [open, setOpen] = useState(false);
  const mount = useHeaderActionsMount();

  const widget = (
    <div className='p7-note-widget'>
      <style dangerouslySetInnerHTML={{ __html: `
        .p7-note-widget{position:relative;display:inline-flex!important;flex:0 0 auto!important}
        .p7-note-panel{position:absolute;right:0;top:50px;width:min(340px,calc(100vw - 20px));padding:12px;border:1px solid var(--pc-border);border-radius:20px;background:var(--pc-bg-card);box-shadow:var(--pc-shadow-lg);z-index:520;display:grid;gap:10px;color:var(--pc-text-primary)}
        .p7-note-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.p7-note-head strong{font-size:14px;font-weight:950}.p7-note-head button{width:32px;height:32px;border-radius:12px;border:1px solid var(--pc-border);background:var(--pc-bg-elevated);color:var(--pc-text-secondary);display:inline-flex;align-items:center;justify-content:center}
        .p7-note-area{width:100%;min-height:180px;max-height:50vh;resize:vertical;box-sizing:border-box;border:1px solid var(--pc-border);border-radius:14px;background:var(--pc-bg-elevated);color:var(--pc-text-primary);padding:10px 12px;font-size:14px;line-height:1.5;font-family:inherit}.p7-note-area:focus{outline:none;border-color:var(--pc-accent-border)}.p7-note-area::placeholder{color:var(--pc-text-muted)}
        .p7-note-foot{display:flex;align-items:center;justify-content:space-between;gap:10px}.p7-note-foot span{font-size:11px;color:var(--pc-text-muted);font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.p7-note-foot button{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;border:1px solid var(--pc-border);background:var(--pc-bg-elevated);color:var(--pc-text-secondary);border-radius:12px;padding:6px 10px;font-size:12px;font-weight:800}
        @media(max-width:767px){.p7-note-widget .pc-v4-iconbtn{width:42px!important;min-width:42px!important;max-width:42px!important;height:42px!important;min-height:42px!important;border-radius:13px!important}.p7-note-panel{position:fixed;top:calc(env(safe-area-inset-top) + 58px);right:10px;left:10px;width:auto}}
      ` }} />
      <button type='button' className='pc-v4-iconbtn' aria-label='Открыть блокнот' title='Блокнот' onClick={() => setOpen((value) => !value)}>
        <NotebookPen size={18} strokeWidth={2.35} />
      </button>
      {open ? <NotepadPanel onClose={() => setOpen(false)} /> : null}
    </div>
  );

  return mount ? createPortal(widget, mount) : null;
}
