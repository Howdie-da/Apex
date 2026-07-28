// ============================================
// client/src/store/useUIStore.ts
// Zustand store for UI layout & toggles
// ============================================

import { create } from 'zustand';
import type { CategoryId } from '../lib/chatData';

interface UIState {
  category: CategoryId;
  searchQuery: string;
  detailsOpen: boolean;
  mobileThread: boolean;
  railCollapsed: boolean;
  
  setCategory: (category: CategoryId) => void;
  setSearchQuery: (query: string) => void;
  setDetailsOpen: (open: boolean) => void;
  setMobileThread: (open: boolean) => void;
  setRailCollapsed: (collapsed: boolean) => void;
  toggleRailCollapsed: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  category: 'all',
  searchQuery: '',
  detailsOpen: false,
  mobileThread: false,
  railCollapsed: false,
  
  setCategory: (category) => set({ category }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
  setMobileThread: (mobileThread) => set({ mobileThread }),
  setRailCollapsed: (railCollapsed) => set({ railCollapsed }),
  toggleRailCollapsed: () => set((state) => ({ railCollapsed: !state.railCollapsed })),
}));
