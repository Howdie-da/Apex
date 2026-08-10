import { create } from "zustand";
import type { User, AuthResponse } from "../types/index";
import { fetchAPI, APIError } from "../lib/api";
import { loadKeyPair, saveKeyPair } from "../lib/keyStore";
import {
  importPrivateKey,
  encryptPrivateKeyWithPassword,
  decryptPrivateKeyWithPassword,
  generateKeyPair,
} from "../lib/crypto";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  error: string | null;
  privateKey: CryptoKey | null;
  initializeAuth: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (
    username: string,
    displayName: string,
    password: string,
  ) => Promise<void>;
  updateDisplayName: (newName: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

// Bypasses holding the private key in memory forever. We extract it to IndexedDB (keyStore) immediately.
// If the user logs in from a new device, we pull the encrypted backup from the DB and force decryption via the login password.
async function setupE2EEKeys(
  user: User,
  password?: string,
): Promise<CryptoKey | null> {
  try {
    const existing = await loadKeyPair(user.id);

    // Case 1: Keys already exist locally in IndexedDB
    if (existing) {
      const privateKey = await importPrivateKey(existing.privateKeyB64);

      if (password && !user.encryptedPrivateKey) {
        const encryptedPrivateKey = await encryptPrivateKeyWithPassword(
          existing.privateKeyB64,
          password,
        );

        await fetchAPI("/keys/public", {
          method: "PUT",
          body: JSON.stringify({
            publicKey: existing.publicKeyB64,
            encryptedPrivateKey,
          }),
        });

        user.encryptedPrivateKey = encryptedPrivateKey;
      }

      return privateKey;
    }

    // Case 2: New device login — restore private key from encrypted cloud backup
    if (user.encryptedPrivateKey && password) {
      const recoveredPrivateKeyB64 = await decryptPrivateKeyWithPassword(
        user.encryptedPrivateKey,
        password,
      );

      if (recoveredPrivateKeyB64) {
        await saveKeyPair(
          user.id,
          user.publicKey || "",
          recoveredPrivateKeyB64,
        );

        const privateKey = await importPrivateKey(recoveredPrivateKeyB64);
        console.log(
          "[E2EE] Successfully restored encrypted private key from cloud backup",
        );
        return privateKey;
      } else {
        console.warn("[E2EE] Failed to decrypt cloud backup with password");
      }
    }

    // Case 3: Session refresh without local keys or password available
    if (user.publicKey && !password) {
      console.warn(
        "[E2EE] Local private key not found during session refresh. Please re-login with username and password to restore key from cloud backup.",
      );
      return null;
    }

    // Case 4: Brand new account registration — generate initial keypair & cloud backup
    const { exported, keyPair } = await generateKeyPair();
    await saveKeyPair(user.id, exported.publicKeyB64, exported.privateKeyB64);

    let encryptedPrivateKey: string | undefined = undefined;

    if (password) {
      encryptedPrivateKey = await encryptPrivateKeyWithPassword(
        exported.privateKeyB64,
        password,
      );
      user.encryptedPrivateKey = encryptedPrivateKey;
    }

    await fetchAPI("/keys/public", {
      method: "PUT",
      body: JSON.stringify({
        publicKey: exported.publicKeyB64,
        encryptedPrivateKey,
      }),
    });

    return keyPair.privateKey;

  } catch (err) {
    console.error("[E2EE] Failed to initialize encryption keys:", err);
    return null;
  }
}

// Global promise latch to prevent race conditions during app initialization
let initPromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: true,
  error: null,
  privateKey: null,

  initializeAuth: async () => {
    // FIX: We buffer the init initialization into a promise to mitigate race conditions 
    // where React's StrictMode double-mounts and spams the /refresh endpoint.
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const savedToken = localStorage.getItem("accessToken");
      const savedRefreshToken = localStorage.getItem("refreshToken");

      if (!savedToken || !savedRefreshToken) {
        set({ isLoading: false });
        return;
      }

      try {
        const res = await fetchAPI<AuthResponse>("/auth/refresh", {
          method: "POST",
          skipAuth: true,
          body: JSON.stringify({ refreshToken: savedRefreshToken }),
        });

        localStorage.setItem("accessToken", res.accessToken);
        localStorage.setItem("refreshToken", res.refreshToken);

        const privateKey = await setupE2EEKeys(res.user);
        set({ accessToken: res.accessToken, user: res.user, privateKey });

      } catch (err) {
        console.error("Session initialization failed:", err);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
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
      const res = await fetchAPI<AuthResponse>("/auth/login", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ username, password }),
      });

      localStorage.setItem("accessToken", res.accessToken);
      localStorage.setItem("refreshToken", res.refreshToken);

      const privateKey = await setupE2EEKeys(res.user, password);
      set({ accessToken: res.accessToken, user: res.user, privateKey });

    } catch (err: any) {
      set({
        error:
          err instanceof APIError
            ? err.message
            : "Login failed. Please try again.",
      });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (username, displayName, password) => {
    set({ isLoading: true, error: null });

    try {
      const res = await fetchAPI<AuthResponse>("/auth/register", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ username, displayName, password }),
      });

      localStorage.setItem("accessToken", res.accessToken);
      localStorage.setItem("refreshToken", res.refreshToken);

      const privateKey = await setupE2EEKeys(res.user, password);
      set({ accessToken: res.accessToken, user: res.user, privateKey });

    } catch (err: any) {
      set({
        error:
          err instanceof APIError
            ? err.message
            : "Registration failed. Please try again.",
      });
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  updateDisplayName: async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    await fetchAPI("/users/me/display-name", {
      method: "PATCH",
      body: JSON.stringify({ displayName: trimmed }),
    });

    set((state) => ({
      user: state.user ? { ...state.user, displayName: trimmed } : null,
    }));
  },

  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    set({ accessToken: null, user: null, error: null, privateKey: null });
  },

  clearError: () => set({ error: null }),
}));

// Global window event listener to catch logouts emitted by the API fetch utility
if (typeof window !== "undefined") {
  window.addEventListener("auth:logout", () => {
    useAuthStore.getState().logout();
  });
}