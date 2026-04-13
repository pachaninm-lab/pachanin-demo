'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Role } from '@/lib/v9/roles';

interface SessionState {
  role: Role;
  demoMode: boolean;
  aiDrawerOpen: boolean;
  sidebarOpen: boolean;

  setRole: (role: Role) => void;
  setDemoMode: (v: boolean) => void;
  setAiDrawerOpen: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
  toggleSidebar: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      role: 'operator',
      demoMode: true,
      // UI state — always starts closed; sidebar is shown via CSS on desktop
      aiDrawerOpen: false,
      sidebarOpen: false,

      setRole: (role) => set({ role }),
      setDemoMode: (demoMode) => set({ demoMode }),
      setAiDrawerOpen: (aiDrawerOpen) => set({ aiDrawerOpen }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    }),
    {
      name: 'pc-session-v9', // unified version key across the app
      // Only persist user preferences, NOT transient UI state
      partialize: (state) => ({
        role: state.role,
        demoMode: state.demoMode,
      }),
    }
  )
);
