// ============================================
// client/src/hooks/useAuth.ts
// Proxy hook exporting useAuthStore for backwards compatibility
// ============================================

import { useAuthStore } from '../store/useAuthStore';

export function useAuth() {
  const store = useAuthStore();
  return store;
}
