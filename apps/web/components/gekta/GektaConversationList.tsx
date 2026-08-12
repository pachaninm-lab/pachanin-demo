'use client';

import * as React from 'react';
import { Check, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import type { GektaConversation } from './GektaChatTypes';

export function GektaConversationList({ conversations, activeId, emptyLabel, renameLabel, deleteLabel, onSelect, onRename, onDelete }: {
  conversations: readonly GektaConversation[];
  activeId: string | null;
  emptyLabel: string;
  renameLabel: string;
  deleteLabel: string;
  onSelect: (conversation: GektaConversation) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const [menuId, setMenuId] = React.useState<string | null>(null);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  if (!conversations.length) return <p className='px-3 py-4 text-sm leading-6 text-slate-500'>{emptyLabel}</p>;
  return (
    <div className='space-y-1'>
      {conversations.map((conversation) => {
        const editing = editingId === conversation.id;
        return (
          <div key={conversation.id} className={`group relative rounded-xl ${activeId === conversation.id ? 'bg-emerald-50' : 'hover:bg-slate-50'}`}>
            {editing ? (
              <div className='flex items-center gap-1 p-2'>
                <input autoFocus value={draft} maxLength={80} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && draft.trim()) { onRename(conversation.id, draft.trim()); setEditingId(null); } if (event.key === 'Escape') setEditingId(null); }} className='min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-600' aria-label={renameLabel} />
                <button type='button' className='flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white' onClick={() => { if (draft.trim()) onRename(conversation.id, draft.trim()); setEditingId(null); }} aria-label={renameLabel}><Check className='h-4 w-4' aria-hidden='true' /></button>
                <button type='button' className='flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white' onClick={() => setEditingId(null)} aria-label='Cancel'><X className='h-4 w-4' aria-hidden='true' /></button>
              </div>
            ) : (
              <>
                <button type='button' onClick={() => onSelect(conversation)} className='block min-h-11 w-full truncate rounded-xl py-2.5 pl-3 pr-11 text-left text-sm text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700'>{conversation.title}</button>
                <button type='button' onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)} className='absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 opacity-100 hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100' aria-label='Conversation menu' aria-expanded={menuId === conversation.id}><MoreHorizontal className='h-4 w-4' aria-hidden='true' /></button>
                {menuId === conversation.id ? <div className='absolute right-1 top-10 z-20 w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl'><button type='button' onClick={() => { setDraft(conversation.title); setEditingId(conversation.id); setMenuId(null); }} className='flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm hover:bg-slate-50'><Pencil className='h-4 w-4' aria-hidden='true' />{renameLabel}</button><button type='button' onClick={() => { setMenuId(null); onDelete(conversation.id); }} className='flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm text-rose-700 hover:bg-rose-50'><Trash2 className='h-4 w-4' aria-hidden='true' />{deleteLabel}</button></div> : null}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
