// ============================================
// client/src/store/useAuthStore.ts
// Zustand store for Authentication & Session
// Phase 2: E2EE key generation and upload on login/register
// ============================================

import { create } from 'zustand';
import type { User, AuthResponse } from '../types/index';
import { fetchAPI, APIError } from '../lib/api';
import { loadKeyPair, saveKeyPair } from '../lib/keyStore';
import { importPrivateKey, encryptPrivateKeyWithPassword, decryptPrivateKeyWithPassword, generateKeyPair } from '../lib/crypto';

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
 * Ensure the user has an E2EE key pair:
 * 1. Try loading existing local key pair from IndexedDB.
 * 2. If missing (new browser/device) and password available, restore from encrypted cloud backup.
 * 3. If no backup exists, generate a new key pair, save locally, encrypt with password, and upload to server.
 */
async function setupE2EEKeys(user: User, password?: string): Promise<CryptoKey | null> {
  try {
    const existing = await loadKeyPair(user.id);
    if (existing) {
      const privateKey = await importPrivateKey(existing.privateKeyB64);
      
      // Self-healing: If user logged in with a password but has no encrypted backup on server, upload it now
      if (password && !user.encryptedPrivateKey) {
        const encryptedPrivateKey = await encryptPrivateKeyWithPassword(existing.privateKeyB64, password);
        await fetchAPI('/keys/public', {
          method: 'PUT',
          body: JSON.stringify({ publicKey: existing.publicKeyB64, encryptedPrivateKey }),
        });
        user.encryptedPrivateKey = encryptedPrivateKey;
      }
      
      return privateKey;
    }

    // Local key missing: try restoring from cloud backup using login password
    if (user.encryptedPrivateKey && password) {
      const recoveredPrivateKeyB64 = await decryptPrivateKeyWithPassword(user.encryptedPrivateKey, password);
      if (recoveredPrivateKeyB64) {
        await saveKeyPair(user.id, user.publicKey || '', recoveredPrivateKeyB64);
        const privateKey = await importPrivateKey(recoveredPrivateKeyB64);
        console.log('[E2EE] Successfully restored encrypted private key from cloud backup');
        return privateKey;
      } else {
        console.warn('[E2EE] Failed to decrypt cloud backup with password');
      }
    }

    // If local key is missing during a silent session refresh, do NOT overwrite remote public key!
    if (user.publicKey && !password) {
      console.warn('[E2EE] Local private key not found during session refresh. Please re-login with username and password to restore key from cloud backup.');
      return null;
    }

    // Otherwise, generate a brand new key pair (first time user or explicit setup)
    const { exported, keyPair } = await generateKeyPair();
    await saveKeyPair(user.id, exported.publicKeyB64, exported.privateKeyB64);

    let encryptedPrivateKey: string | undefined = undefined;
    if (password) {
      encryptedPrivateKey = await encryptPrivateKeyWithPassword(exported.privateKeyB64, password);
      user.encryptedPrivateKey = encryptedPrivateKey;
    }

    await fetchAPI('/keys/public', {
      method: 'PUT',
      body: JSON.stringify({ publicKey: exported.publicKeyB64, encryptedPrivateKey }),
    });

    return keyPair.privateKey;
  } catch (err) {
    console.error('[E2EE] Failed to initialize encryption keys:', err);
    return null;
  }
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

        // Restore E2EE keys from IndexedDB (or check cloud availability)
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

      const privateKey = await setupE2EEKeys(res.user, password);
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

      const privateKey = await setupE2EEKeys(res.user, password);
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
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    // Note: Local private keys are preserved in IndexedDB across logouts and session expirations
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
