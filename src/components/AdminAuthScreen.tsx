import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react';

export interface AuthSession {
  token: string;
  sessionId: string;
  user: {
    email: string;
    role: string;
  };
}

interface AdminAuthScreenProps {
  onAuthenticated: (session: AuthSession) => void;
}

type AuthMode = 'loading' | 'unconfigured' | 'env' | 'claimed';

export const AdminAuthScreen: React.FC<AdminAuthScreenProps> = ({
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<AuthMode>('loading');
  const [adminEmail, setAdminEmail] = useState('admin@vijaya.com');
  const [maxConcurrentSessions, setMaxConcurrentSessions] = useState(25);
  const [email, setEmail] = useState('admin@vijaya.com');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const adminLoginUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/admin/login`
      : '/admin/login';

  useEffect(() => {
    let active = true;
    const loadStatus = async () => {
      try {
        const res = await fetch('/api/auth/status');
        if (!res.ok) throw new Error('Unable to reach authentication service.');
        const data = (await res.json()) as {
          mode: 'env' | 'claimed' | 'unconfigured';
          adminEmail: string;
          maxConcurrentSessions?: number;
        };
        if (!active) return;
        setMode(data.mode);
        setAdminEmail(data.adminEmail);
        setEmail(data.adminEmail);
        if (typeof data.maxConcurrentSessions === 'number') {
          setMaxConcurrentSessions(data.maxConcurrentSessions);
        }
      } catch (err: unknown) {
        if (!active) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to check administrator setup status.'
        );
        setMode('claimed');
      }
    };
    loadStatus();
    return () => {
      active = false;
    };
  }, []);

  const handleCopyLoginLink = async () => {
    try {
      await navigator.clipboard.writeText(adminLoginUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
    }
  };

  const isSetupMode = mode === 'unconfigured';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Please enter both your Administrator User ID and password.');
      return;
    }

    if (isSetupMode) {
      if (password.length < 8) {
        setError('Administrator password must be at least 8 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter to confirm.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const endpoint = isSetupMode ? '/api/auth/setup' : '/api/auth/login';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
        }),
      });

      const data = (await response.json()) as {
        token?: string;
        sessionId?: string;
        user?: { email: string; role: string };
        error?: string;
      };

      if (!response.ok || !data.token || !data.user) {
        if (response.status === 409 && isSetupMode) {
          setMode('claimed');
        }
        throw new Error(data.error || 'Authentication failed.');
      }

      onAuthenticated({
        token: data.token,
        sessionId: data.sessionId || '',
        user: data.user,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Unable to complete authentication.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd] flex flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-[440px]">
        {/* Brand Identity */}
        <div className="mb-7 flex items-center justify-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#6366F1] text-white shrink-0">
            <svg
              width="18"
              height="18"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2.5 4.25L8 1.5L13.5 4.25V11.75L8 14.5L2.5 11.75V4.25Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M5.5 8L7.25 9.75L10.75 6.25"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div>
            <div className="text-[18px] font-semibold tracking-[-0.02em] text-[#dae2fd] leading-tight">
              VijayaEle_CRM
            </div>
            <div className="text-[12px] text-[#908fa0]">
              Enterprise Revenue Workspace
            </div>
          </div>
        </div>

        {/* Auth Card */}
        <div className="rounded-lg border border-[#464554]/45 bg-[#171f33] shadow-2xl overflow-hidden">
          <div className="border-b border-[#464554]/30 bg-[#131b2e] px-6 py-5">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#c0c1ff]">
              {isSetupMode ? (
                <>
                  <KeyRound className="h-3.5 w-3.5 text-[#4edea3]" />
                  <span>Initial Administrator Setup</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5 text-[#4edea3]" />
                  <span>Administrator Portal · /admin/login</span>
                </>
              )}
            </div>
            <h1 className="mt-1.5 text-[18px] font-semibold tracking-[-0.015em] text-[#dae2fd]">
              {isSetupMode
                ? 'Set your administrator password'
                : 'Sign in to VijayaEle_CRM'}
            </h1>
            <p className="mt-1 text-[13px] text-[#908fa0] leading-relaxed">
              {isSetupMode
                ? `Initialize credentials for ${adminEmail} to unlock this workspace.`
                : 'Sign in from one or multiple browsers simultaneously without disconnecting active sessions.'}
            </p>
          </div>

          {mode === 'loading' ? (
            <div className="flex items-center justify-center gap-2.5 px-6 py-12 text-[13px] text-[#908fa0]">
              <Loader2 className="h-4 w-4 animate-spin text-[#8083ff]" />
              <span>Checking workspace security status...</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Admin User ID */}
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-email"
                  className="block text-[12px] font-medium text-[#c7c4d7]"
                >
                  Admin User ID
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#908fa0]" />
                  <input
                    id="admin-email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={adminEmail}
                    className="h-10 w-full rounded border border-[#464554]/55 bg-[#131b2e] pl-9 pr-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label
                  htmlFor="admin-password"
                  className="block text-[12px] font-medium text-[#c7c4d7]"
                >
                  {isSetupMode ? 'Create Admin Password' : 'Password'}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#908fa0]" />
                  <input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isSetupMode ? 'new-password' : 'current-password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={
                      isSetupMode ? 'Enter at least 8 characters' : 'Enter password'
                    }
                    className="h-10 w-full rounded border border-[#464554]/55 bg-[#131b2e] pl-9 pr-10 text-[13px] text-[#dae2fd] placeholder-[#908fa0] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2.5 top-2 rounded p-1 text-[#908fa0] hover:text-[#dae2fd] transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Confirm Password (First-run Setup only) */}
              {isSetupMode && (
                <div className="space-y-1.5">
                  <label
                    htmlFor="admin-password-confirm"
                    className="block text-[12px] font-medium text-[#c7c4d7]"
                  >
                    Confirm Admin Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#908fa0]" />
                    <input
                      id="admin-password-confirm"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      className="h-10 w-full rounded border border-[#464554]/55 bg-[#131b2e] pl-9 pr-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
                    />
                  </div>
                </div>
              )}

              {/* Validation / Auth Error */}
              {error && (
                <div
                  role="alert"
                  className="rounded border border-[#ef4444]/40 bg-[#93000a]/25 px-3.5 py-2.5 text-[12px] text-[#ffb4ab]"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex h-10 items-center justify-center gap-2 rounded bg-[#6366F1] px-4 text-[13px] font-medium text-white hover:bg-[#5558e6] disabled:opacity-55 transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{isSetupMode ? 'Configuring...' : 'Signing in...'}</span>
                  </>
                ) : (
                  <span>
                    {isSetupMode ? 'Save Password & Enter Workspace' : 'Sign In'}
                  </span>
                )}
              </button>

              {/* Shareable Admin Login Link & Concurrent Login Notice */}
              <div className="mt-2 rounded-md border border-[#464554]/35 bg-[#131b2e] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#908fa0]">
                    <Link2 className="h-3.5 w-3.5 text-[#8083ff]" />
                    Admin Login Web Link
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLoginLink}
                    className="inline-flex items-center gap-1 rounded border border-[#464554]/50 bg-[#171f33] px-2 py-0.5 text-[11px] font-medium text-[#c0c1ff] hover:border-[#6366F1]/60 hover:text-[#e1e0ff] transition-colors"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="h-3 w-3 text-[#4edea3]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <div className="truncate font-mono text-[11px] text-[#dae2fd] select-all">
                  {adminLoginUrl}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#908fa0]">
                  <Users className="h-3.5 w-3.5 text-[#4edea3] shrink-0" />
                  <span>
                    Multi-login enabled: up to {maxConcurrentSessions} simultaneous admin sessions.
                  </span>
                </div>
              </div>

              {isSetupMode && (
                <p className="pt-0.5 text-[11px] leading-relaxed text-[#908fa0]">
                  For persistent deployments, configure{' '}
                  <span className="font-mono text-[#c7c4d7]">ADMIN_PASSWORD</span> in
                  Settings &gt; Secrets so this credential survives server restarts.
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
