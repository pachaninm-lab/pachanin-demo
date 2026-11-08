'use client';

import * as React from 'react';
import { Check, FolderInput, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react';
import type { GektaProject } from '@/lib/gekta/projects';
import type { GektaConversation } from './GektaChatTypes';

export function GektaConversationList({ conversations, projects, activeId, emptyLabel, renameLabel, deleteLabel, projectLabel, noProjectLabel, onSelect, onRename, onDelete, onProject }: {
  conversations: readonly GektaConversation[];
  projects: readonly GektaProject[];
  activeId: string | null;
  emptyLabel: string;
  renameLabel: string;
  deleteLabel: string;
  projectLabel: string;
  noProjectLabel: string;
  onSelect: (conversation: GektaConversation) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onProject: (conversationId: string, projectId: string | null) => void;
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
                <input autoFocus value={draft} maxLength={80} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && draft.trim()) { onRename(conversation.id, draft.trim()); setEditingId(null); } if (event.key === 'Escape') setEditingId(null); }} className='min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-600' aria-label={renameLabel} />
                <button type='button' className='flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white' onClick={() => { if (draft.trim()) onRename(conversation.id, draft.trim()); setEditingId(null); }} aria-label={renameLabel}><Check className='h-4 w-4' aria-hidden='true' /></button>
                <button type='button' className='flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white' onClick={() => setEditingId(null)} aria-label='Cancel'><X className='h-4 w-4' aria-hidden='true' /></button>
              </div>
            ) : (
              <>
                <button type='button' onClick={() => onSelect(conversation)} className='block min-h-11 w-full truncate rounded-xl py-2.5 pl-3 pr-14 text-left text-sm text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700'>{conversation.title}</button>
                <button type='button' onClick={() => setMenuId(menuId === conversation.id ? null : conversation.id)} className='absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 opacity-100 hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100' aria-label='Conversation menu' aria-expanded={menuId === conversation.id}><MoreHorizontal className='h-4 w-4' aria-hidden='true' /></button>
                {menuId === conversation.id ? (
                  <div className='absolute right-1 top-11 z-20 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl'>
                    <button type='button' onClick={() => { setDraft(conversation.title); setEditingId(conversation.id); setMenuId(null); }} className='flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm hover:bg-slate-50'><Pencil className='h-4 w-4' aria-hidden='true' />{renameLabel}</button>
                    {projects.length ? (
                      <label className='mt-1 block px-2.5 pb-1'>
                        <span className='flex items-center gap-2 py-1 text-xs font-semibold text-slate-500'><FolderInput className='h-3.5 w-3.5' aria-hidden='true' />{projectLabel}</span>
                        <select
                          value={conversation.projectId ?? ''}
                          onChange={(event) => { onProject(conversation.id, event.target.value || null); setMenuId(null); }}
                          className='mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-emerald-500'
                          aria-label={projectLabel}
                        >
                          <option value=''>{noProjectLabel}</option>
                          {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                        </select>
                      </label>
                    ) : null}
                    <button type='button' onClick={() => { setMenuId(null); onDelete(conversation.id); }} className='flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 text-left text-sm text-rose-700 hover:bg-rose-50'><Trash2 className='h-4 w-4' aria-hidden='true' />{deleteLabel}</button>
                  </div>
                ) : null}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
