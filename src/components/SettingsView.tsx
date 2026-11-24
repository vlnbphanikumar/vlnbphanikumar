import React, { useCallback, useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  LogOut,
  Monitor,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { DealStage, WorkspaceSettings } from '../types/crm';
import { DEAL_STAGES, formatCurrency } from '../utils/formatters';

interface ActiveSessionInfo {
  id: string;
  email: string;
  role: string;
  deviceLabel: string;
  createdAt: number;
  lastActiveAt: number;
  expiresAt: number;
  isCurrent: boolean;
}

interface SessionsResponse {
  loginPath: string;
  concurrentLoginsAllowed: boolean;
  maxConcurrentSessions: number;
  activeCount: number;
  sessions: ActiveSessionInfo[];
}

interface SettingsViewProps {
  settings: WorkspaceSettings;
  authToken: string;
  onUnauthorized: () => void;
  onShowToast: (msg: string) => void;
  onSaveSettings: (
    next: WorkspaceSettings,
    applyProbabilitiesToOpenDeals: boolean
  ) => void;
  onExportBackup: () => void;
  onResetWorkspace: () => void;
}

function formatSessionTime(ts: number): string {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  authToken,
  onUnauthorized,
  onShowToast,
  onSaveSettings,
  onExportBackup,
  onResetWorkspace,
}) => {
  const [fiscalQuarter, setFiscalQuarter] = useState(settings.fiscalQuarter);
  const [quotaInput, setQuotaInput] = useState(String(settings.quarterlyQuota));
  const [stageProbs, setStageProbs] = useState<Record<DealStage, number>>(
    settings.stageProbabilities
  );
  const [applyToOpen, setApplyToOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Admin Login Link & Multi-Session State
  const [copiedLink, setCopiedLink] = useState(false);
  const [sessionsData, setSessionsData] = useState<SessionsResponse | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const adminLoginUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/admin/login`
      : '/admin/login';

  useEffect(() => {
    setFiscalQuarter(settings.fiscalQuarter);
    setQuotaInput(String(settings.quarterlyQuota));
    setStageProbs(settings.stageProbabilities);
  }, [settings]);

  const fetchSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const response = await fetch('/api/auth/sessions', {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      const data = (await response.json()) as SessionsResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load active sessions.');
      }
      setSessionsData(data);
    } catch (err: unknown) {
      setSessionsError(
        err instanceof Error ? err.message : 'Unable to load active sessions.'
      );
    } finally {
      setSessionsLoading(false);
    }
  }, [authToken, onUnauthorized]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCopyLoginLink = async () => {
    try {
      await navigator.clipboard.writeText(adminLoginUrl);
      setCopiedLink(true);
      onShowToast('Copied Admin Login web link');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      onShowToast('Select and copy the Admin Login link manually');
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      const response = await fetch(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      const data = (await response.json()) as {
        ok?: boolean;
        revokedCurrent?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || 'Failed to revoke session.');
      }
      if (data.revokedCurrent) {
        onUnauthorized();
        return;
      }
      onShowToast('Signed out selected session');
      await fetchSessions();
    } catch (err: unknown) {
      setSessionsError(
        err instanceof Error ? err.message : 'Unable to revoke session.'
      );
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOtherSessions = async () => {
    setRevokingOthers(true);
    try {
      const response = await fetch('/api/auth/sessions/revoke-others', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (response.status === 401) {
        onUnauthorized();
        return;
      }
      const data = (await response.json()) as {
        ok?: boolean;
        revokedCount?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || 'Unable to sign out other sessions.');
      }
      onShowToast(
        data.revokedCount
          ? `Signed out ${data.revokedCount} other ${data.revokedCount === 1 ? 'session' : 'sessions'}`
          : 'No other active sessions to sign out'
      );
      await fetchSessions();
    } catch (err: unknown) {
      setSessionsError(
        err instanceof Error ? err.message : 'Unable to sign out other sessions.'
      );
    } finally {
      setRevokingOthers(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericQuota = Math.max(100_000, Number(quotaInput) || settings.quarterlyQuota);
    onSaveSettings(
      {
        ...settings,
        fiscalQuarter: fiscalQuarter.trim() || 'Q4 2026',
        quarterlyQuota: numericQuota,
        stageProbabilities: stageProbs,
      },
      applyToOpen
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const otherSessionsCount =
    sessionsData?.sessions.filter((s) => !s.isCurrent).length ?? 0;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Admin Login Web Link & Multi-Session Access */}
      <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#464554]/30 bg-[#131b2e] px-6 py-4">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-[#c0c1ff]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#4edea3]" />
              <span>Multi-Device Access Enabled</span>
            </div>
            <h2 className="mt-1 text-[17px] font-semibold tracking-[-0.01em] text-[#dae2fd]">
              Admin Login Web Link & Concurrent Sessions
            </h2>
            <p className="mt-0.5 text-[13px] text-[#908fa0]">
              Share this direct login link so multiple administrators can sign in simultaneously without disconnecting each other.
            </p>
          </div>

          {sessionsData && (
            <div className="rounded border border-[#10B981]/30 bg-[#10B981]/12 px-3 py-1.5 text-right shrink-0">
              <div className="font-mono text-[13px] font-semibold tabular-nums text-[#4edea3]">
                {sessionsData.activeCount} / {sessionsData.maxConcurrentSessions}
              </div>
              <div className="text-[11px] text-[#c7c4d7]">Active Logins</div>
            </div>
          )}
        </div>

        <div className="p-6 space-y-5">
          {/* Direct Copyable Admin Login Web Link */}
          <div className="space-y-1.5">
            <label
              htmlFor="admin-login-url-field"
              className="block text-[12px] font-medium text-[#c7c4d7]"
            >
              Direct Admin Login Web Link
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Link2 className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#8083ff]" />
                <input
                  id="admin-login-url-field"
                  type="text"
                  readOnly
                  value={adminLoginUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-9 w-full rounded border border-[#464554]/55 bg-[#131b2e] pl-9 pr-3 font-mono text-[12px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyLoginLink}
                  className="inline-flex h-9 items-center gap-1.5 rounded bg-[#6366F1] px-3.5 text-[12px] font-medium text-white hover:bg-[#5558e6] transition-colors whitespace-nowrap"
                >
                  {copiedLink ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy Link
                    </>
                  )}
                </button>
                <a
                  href="/admin/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded border border-[#464554]/55 bg-[#131b2e] px-3 text-[12px] font-medium text-[#dae2fd] hover:border-[#6366F1]/55 hover:bg-[#222a3d] transition-colors whitespace-nowrap"
                >
                  <span>Open</span>
                  <ExternalLink className="h-3.5 w-3.5 text-[#adc6ff]" />
                </a>
              </div>
            </div>
          </div>

          {/* Active Concurrent Sessions List */}
          <div className="border-t border-[#464554]/30 pt-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-[#dae2fd]">
                Simultaneous Active Sessions
              </h3>
              <div className="flex items-center gap-2">
                {otherSessionsCount > 0 && (
                  <button
                    type="button"
                    disabled={revokingOthers}
                    onClick={handleRevokeOtherSessions}
                    className="inline-flex h-8 items-center gap-1.5 rounded border border-[#ef4444]/40 bg-[#131b2e] px-2.5 text-[12px] font-medium text-[#ffb4ab] hover:bg-[#93000a]/30 disabled:opacity-50 transition-colors"
                  >
                    {revokingOthers ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <LogOut className="h-3.5 w-3.5" />
                    )}
                    Sign Out Other Devices ({otherSessionsCount})
                  </button>
                )}
                <button
                  type="button"
                  onClick={fetchSessions}
                  disabled={sessionsLoading}
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-[#464554]/55 bg-[#131b2e] px-2.5 text-[12px] font-medium text-[#c7c4d7] hover:bg-[#222a3d] hover:text-[#dae2fd] disabled:opacity-50 transition-colors"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${sessionsLoading ? 'animate-spin' : ''}`}
                  />
                  Refresh
                </button>
              </div>
            </div>

            {sessionsError && (
              <div className="rounded border border-[#ef4444]/40 bg-[#93000a]/25 px-3.5 py-2.5 text-[12px] text-[#ffb4ab]">
                {sessionsError}
              </div>
            )}

            {sessionsLoading && !sessionsData ? (
              <div className="flex items-center gap-2 py-4 text-[13px] text-[#908fa0]">
                <Loader2 className="h-4 w-4 animate-spin text-[#8083ff]" />
                <span>Loading active sessions...</span>
              </div>
            ) : (
              <div className="divide-y divide-[#464554]/25 rounded-md border border-[#464554]/35 bg-[#131b2e] overflow-hidden">
                {(sessionsData?.sessions ?? []).map((sess) => (
                  <div
                    key={sess.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-[#171f33] border border-[#464554]/40 text-[#adc6ff] shrink-0">
                        <Monitor className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-[#dae2fd] truncate">
                            {sess.deviceLabel}
                          </span>
                          {sess.isCurrent && (
                            <span className="rounded bg-[#10B981]/18 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#4edea3]">
                              This Device
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-[#908fa0]">
                          <span>{sess.email}</span>
                          <span>Signed in {formatSessionTime(sess.createdAt)}</span>
                          <span>Last active {formatSessionTime(sess.lastActiveAt)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={revokingId === sess.id}
                      onClick={() => handleRevokeSession(sess.id)}
                      className="inline-flex h-7 items-center gap-1 rounded border border-[#464554]/50 bg-[#171f33] px-2.5 text-[11px] font-medium text-[#c7c4d7] hover:border-[#ef4444]/45 hover:text-[#ffb4ab] disabled:opacity-50 transition-colors shrink-0"
                    >
                      {revokingId === sess.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      {sess.isCurrent ? 'Sign Out' : 'Revoke'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Revenue Plan & Stage Probabilities */}
      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-6 space-y-6"
      >
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#dae2fd]">
            Revenue Plan & Stage Probabilities
          </h2>
          <p className="mt-1 text-[13px] text-[#908fa0]">
            Adjust quarterly revenue targets and stage weighting used across dashboards and forecasts.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
              Active Fiscal Period
            </label>
            <input
              type="text"
              value={fiscalQuarter}
              onChange={(e) => setFiscalQuarter(e.target.value)}
              className="h-9 w-full rounded border border-[#464554]/55 bg-[#131b2e] px-3 text-[13px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
              Quarterly Revenue Quota (USD)
            </label>
            <input
              type="number"
              min={100000}
              step={50000}
              value={quotaInput}
              onChange={(e) => setQuotaInput(e.target.value)}
              className="h-9 w-full rounded border border-[#464554]/55 bg-[#131b2e] px-3 font-mono text-[13px] tabular-nums text-[#dae2fd] focus:border-[#6366F1] focus:outline-none"
            />
            <div className="mt-1 text-[11px] text-[#908fa0] font-mono">
              Formatted: {formatCurrency(Number(quotaInput) || 0)}
            </div>
          </div>
        </div>

        <div className="border-t border-[#464554]/30 pt-5">
          <h3 className="text-[14px] font-semibold text-[#dae2fd] mb-3">
            Default Stage Win Probabilities
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {DEAL_STAGES.map((stage) => (
              <div key={stage}>
                <label className="block text-[11px] font-medium text-[#908fa0] mb-1 truncate">
                  {stage}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={stage === 'Closed Won'}
                    value={stageProbs[stage]}
                    onChange={(e) =>
                      setStageProbs((prev) => ({
                        ...prev,
                        [stage]: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      }))
                    }
                    className="h-9 w-full rounded border border-[#464554]/55 bg-[#131b2e] pl-3 pr-7 font-mono text-[13px] tabular-nums text-[#dae2fd] disabled:opacity-50 focus:border-[#6366F1] focus:outline-none"
                  />
                  <span className="pointer-events-none absolute right-2.5 top-2 text-[12px] text-[#908fa0]">
                    %
                  </span>
                </div>
              </div>
            ))}
          </div>

          <label className="mt-4 flex items-center gap-2.5 text-[13px] text-[#c7c4d7] cursor-pointer">
            <input
              type="checkbox"
              checked={applyToOpen}
              onChange={(e) => setApplyToOpen(e.target.checked)}
              className="h-4 w-4 rounded border-[#464554] bg-[#0b1326] accent-[#6366F1]"
            />
            Recalculate probability on all existing open deals using these defaults
          </label>
        </div>

        <div className="flex items-center justify-between border-t border-[#464554]/30 pt-4">
          <span className="text-[13px] text-[#4edea3]">
            {saved ? 'Workspace configuration updated.' : ''}
          </span>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-1.5 rounded bg-[#6366F1] px-4 text-[13px] font-medium text-white hover:bg-[#5558e6] transition-colors"
          >
            <Check className="h-4 w-4" />
            Save Configuration
          </button>
        </div>
      </form>

      {/* Data Management */}
      <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-6 space-y-4">
        <div>
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#dae2fd]">
            Workspace Data & Backups
          </h2>
          <p className="mt-1 text-[13px] text-[#908fa0]">
            Changes are automatically persisted in your browser. Export a JSON snapshot or restore the baseline enterprise dataset.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onExportBackup}
            className="inline-flex h-9 items-center gap-2 rounded border border-[#464554]/55 bg-[#131b2e] px-4 text-[13px] font-medium text-[#dae2fd] hover:bg-[#222a3d] transition-colors"
          >
            <Download className="h-4 w-4 text-[#c0c1ff]" />
            Export JSON Snapshot
          </button>

          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="inline-flex h-9 items-center gap-2 rounded border border-[#ef4444]/40 bg-[#131b2e] px-4 text-[13px] font-medium text-[#ffb4ab] hover:bg-[#93000a]/30 transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Demo Dataset
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#ffb4ab]">
                Restore initial deals & contacts?
              </span>
              <button
                type="button"
                onClick={() => {
                  onResetWorkspace();
                  setConfirmReset(false);
                }}
                className="h-9 rounded bg-[#93000a] px-3.5 text-[12px] font-medium text-[#ffdad6] hover:bg-[#b91c1c]"
              >
                Confirm Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="h-9 rounded border border-[#464554]/50 bg-[#131b2e] px-3 text-[12px] text-[#c7c4d7]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
