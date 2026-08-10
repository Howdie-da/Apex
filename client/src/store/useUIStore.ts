import { create } from "zustand";
import type { CategoryId } from "../types";

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

// Separates ephemeral layout state from the DB-backed data stores.
// Forces React to only re-render navigation components when the viewport toggles, instead of on every chat message payload.
export const useUIStore = create<UIState>((set) => ({
  category: "all",
  searchQuery: "",
  detailsOpen: false,
  mobileThread: false,
  railCollapsed: false,
  setCategory: (category) => set({ category }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setDetailsOpen: (detailsOpen) => set({ detailsOpen }),
  setMobileThread: (mobileThread) => set({ mobileThread }),
  setRailCollapsed: (railCollapsed) => set({ railCollapsed }),
  toggleRailCollapsed: () =>
    set((state) => ({ railCollapsed: !state.railCollapsed })),
}));