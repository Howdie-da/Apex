// ============================================
// client/src/features/auth/AuthPage.tsx
// Brutalist Authentication — Case Sensitive & Clean (80% compact ratio)
// ============================================

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { AlertTriangle, User, Lock, KeyRound } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const { login, register, error, clearError } = useAuth();

  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setFormError(null);
    clearError();
    setUsername('');
    setDisplayName('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearError();

    if (!username.trim() || !password) {
      setFormError('All required fields must be filled.');
      return;
    }
    if (username.trim().length < 3) {
      setFormError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    if (!isLogin) {
      if (!displayName.trim()) {
        setFormError('Display name is required.');
        return;
      }
      if (password !== confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), displayName.trim(), password);
      }
    } catch {
      // Handled by AuthContext
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2.5 bg-transparent text-xs sm:text-sm focus:outline-none transition-colors placeholder:text-muted-foreground' +
    ' border border-border focus:border-foreground' +
    ' font-sans text-foreground';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-6 select-none bg-background text-foreground"
    >
      {/* Brand */}
      <div className="mb-6 text-center">
        <div
          className="inline-flex items-center justify-center w-12 h-12 mb-3 font-mono font-bold text-lg border border-foreground bg-foreground text-background"
        >
          A
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Apex
        </h1>
        <p className="mt-1 font-mono text-[11px] tracking-wider text-muted-foreground">
          Secure · Private · Self-Hosted
        </p>
      </div>

      {/* Form Card */}
      <div className="w-full max-w-sm border border-border bg-card">
        <div className="px-5 py-3 border-b border-border bg-secondary">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            {isLogin ? 'Sign In' : 'Create Account'}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Error display */}
          {(formError || error) && (
            <div
              className="flex items-start gap-2 px-3 py-2 border border-foreground text-xs font-mono bg-background text-foreground"
              role="alert"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{formError || error}</span>
            </div>
          )}

          {/* Username */}
          <div className="space-y-1">
            <label htmlFor="username" className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                id="username"
                type="text"
                required
                autoComplete="username"
                placeholder="your_handle"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>

          {/* Display Name */}
          {!isLogin && (
            <div className="space-y-1">
              <label htmlFor="displayName" className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Display Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  id="displayName"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Your Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>
          )}

          {/* Password */}
          <div className="space-y-1">
            <label htmlFor="password" className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                id="password"
                type="password"
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>

          {/* Confirm Password */}
          {!isLogin && (
            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="font-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Confirm Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            id="auth-submit"
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 font-mono font-bold text-xs tracking-wider border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-foreground text-background border-foreground hover:bg-secondary hover:text-foreground mt-1"
          >
            {loading ? '[ Authenticating... ]' : isLogin ? '[ Sign In ]' : '[ Create Account ]'}
          </button>
        </form>

        <div className="px-5 pb-4 text-center border-t border-border pt-3.5">
          <button
            onClick={toggleAuthMode}
            className="font-mono text-[11px] tracking-wider text-muted-foreground underline-offset-2 hover:underline transition-colors cursor-pointer"
          >
            {isLogin ? 'No account? → Register' : 'Have account? → Sign In'}
          </button>
        </div>
      </div>

      <p className="mt-6 font-mono text-[11px] tracking-wider text-muted-foreground">
        Apex · Self-Hosted · E2EE Ready
      </p>
    </div>
  );
};

export default AuthPage;
