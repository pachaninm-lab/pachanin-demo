'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PlatformRole = 'operator' | 'buyer' | 'seller' | 'driver' | 'bank' | 'arbitrator' | 'compliance';
export type FieldPreviewRole = 'driver' | 'surveyor' | 'elevator' | 'lab';

interface PlatformV7RState {
  role: PlatformRole;
  roleSelected: boolean;
  demoMode: boolean;
  sidebarOpen: boolean;
  commandOpen: boolean;
  shortcutsOpen: boolean;
  notificationsOpen: boolean;
  fieldPreviewRole: FieldPreviewRole;
  unreadNotifications: number;
  setRole: (role: PlatformRole) => void;
  setDemoMode: (value: boolean) => void;
  setSidebarOpen: (value: boolean) => void;
  setCommandOpen: (value: boolean) => void;
  setShortcutsOpen: (value: boolean) => void;
  setNotificationsOpen: (value: boolean) => void;
  setFieldPreviewRole: (value: FieldPreviewRole) => void;
  setUnreadNotifications: (value: number) => void;
}

export const usePlatformV7RStore = create<PlatformV7RState>()(
  persist(
    (set) => ({
      role: 'operator',
      roleSelected: false,
      demoMode: true,
      sidebarOpen: false,
      commandOpen: false,
      shortcutsOpen: false,
      notificationsOpen: false,
      fieldPreviewRole: 'driver',
      unreadNotifications: 3,
      setRole: (role) => set({ role, roleSelected: true }),
      setDemoMode: (demoMode) => set({ demoMode }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setCommandOpen: (commandOpen) => set({ commandOpen }),
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),
      setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
      setFieldPreviewRole: (fieldPreviewRole) => set({ fieldPreviewRole }),
      setUnreadNotifications: (unreadNotifications) => set({ unreadNotifications }),
    }),
    {
      name: 'pc-session-v9r',
      partialize: (state) => ({
        role: state.role,
        roleSelected: state.roleSelected,
        demoMode: state.demoMode,
        fieldPreviewRole: state.fieldPreviewRole,
      }),
    }
  )
);
