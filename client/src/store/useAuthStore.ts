// ============================================
// client/src/store/useAuthStore.ts
// Zustand store for Authentication & Session
// Phase 2: E2EE key generation and upload on login/register
// ============================================

import { create } from 'zustand';
import type { User, AuthResponse } from '../types/index';
import { fetchAPI, APIError } from '../lib/api';
import { ensureKeyPair, clearKeyPair } from '../lib/keyStore';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  /** In-memory private key — never serialized or stored in JS state long-term */
  privateKey: CryptoKey | null;

  initializeAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, displayName: string, password: string) => Promise<void>;
  updateDisplayName: (newName: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

/**
 * Ensure the user has an ECDH key pair:
 * 1. Load from IndexedDB or generate a new one.
 * 2. If newly generated OR server doesn't have a public key yet, upload to server.
 * Returns the in-memory private CryptoKey.
 */
async function setupE2EEKeys(user: User): Promise<CryptoKey> {
  const { publicKeyB64, privateKey, isNew } = await ensureKeyPair(user.id);

  // Upload if we just generated it, or if the server record is missing
  if (isNew || !user.publicKey) {
    await fetchAPI('/keys/public', {
      method: 'PUT',
      body: JSON.stringify({ publicKey: publicKeyB64 }),
    });
  }

  return privateKey;
}

let initPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  error: null,
  privateKey: null,

  initializeAuth: async () => {
    if (initPromise) return initPromise;
    
    initPromise = (async () => {
      const savedToken = localStorage.getItem('accessToken');
      const savedRefreshToken = localStorage.getItem('refreshToken');

      if (!savedToken || !savedRefreshToken) {
        set({ isLoading: false });
        return;
      }

      try {
        const res = await fetchAPI<AuthResponse>('/auth/refresh', {
          method: 'POST',
          skipAuth: true,
          body: JSON.stringify({ refreshToken: savedRefreshToken }),
        });

        localStorage.setItem('accessToken', res.accessToken);
        localStorage.setItem('refreshToken', res.refreshToken);

        // Restore E2EE keys from IndexedDB
        const privateKey = await setupE2EEKeys(res.user);
        set({ accessToken: res.accessToken, user: res.user, privateKey });
      } catch (err) {
        console.error('Session initialization failed:', err);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      } finally {
        set({ isLoading: false });
      }
    })();
    
    try {
      await initPromise;
    } finally {
      initPromise = null;
    }
  },

  login: async (username, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetchAPI<AuthResponse>('/auth/login', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ username, password }),
      });

      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('refreshToken', res.refreshToken);

      const privateKey = await setupE2EEKeys(res.user);
      set({ accessToken: res.accessToken, user: res.user, privateKey });
    } catch (err: any) {
      set({ error: err instanceof APIError ? err.message : 'Login failed. Please try again.' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (username, displayName, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetchAPI<AuthResponse>('/auth/register', {
        method: 'POST',
        skipAuth: true,
        body: JSON.stringify({ username, displayName, password }),
      });

      localStorage.setItem('accessToken', res.accessToken);
      localStorage.setItem('refreshToken', res.refreshToken);

      const privateKey = await setupE2EEKeys(res.user);
      set({ accessToken: res.accessToken, user: res.user, privateKey });
    } catch (err: any) {
      set({ error: err instanceof APIError ? err.message : 'Registration failed. Please try again.' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateDisplayName: async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await fetchAPI('/users/me/display-name', {
      method: 'PATCH',
      body: JSON.stringify({ displayName: trimmed })
    });
    set((state) => ({
      user: state.user ? { ...state.user, displayName: trimmed } : null
    }));
  },

  logout: () => {
    const userId = useAuthStore.getState().user?.id;
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    // Clear private key from IndexedDB on explicit logout for security
    if (userId) clearKeyPair(userId).catch(console.error);
    set({ accessToken: null, user: null, error: null, privateKey: null });
  },

  clearError: () => set({ error: null }),
}));

// Listen for global auth:logout events (e.g., token expired)
if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => {
    useAuthStore.getState().logout();
  });
}
