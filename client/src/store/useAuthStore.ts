// ============================================
// client/src/store/useAuthStore.ts
// Zustand store for Authentication & Session
// ============================================

import { create } from 'zustand';
import type { User, AuthResponse } from '../types/index';
import { fetchAPI, APIError } from '../lib/api';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;

  initializeAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, displayName: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  error: null,

  initializeAuth: async () => {
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
      set({ accessToken: res.accessToken, user: res.user });
    } catch (err) {
      console.error('Session initialization failed:', err);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      set({ isLoading: false });
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
      set({ accessToken: res.accessToken, user: res.user });
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
      set({ accessToken: res.accessToken, user: res.user });
    } catch (err: any) {
      set({ error: err instanceof APIError ? err.message : 'Registration failed. Please try again.' });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ accessToken: null, user: null, error: null });
  },

  clearError: () => set({ error: null }),
}));

// Listen for global auth:logout events
if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => {
    useAuthStore.getState().logout();
  });
}
