import React from 'react';
import {
  BarChart3,
  Box,
  Compass,
  Kanban,
  LayoutDashboard,
  LogOut,
  Settings,
  Table2,
  Users,
  X,
} from 'lucide-react';
import { Deal, NavSection, WorkspaceSettings } from '../types/crm';
import { formatCurrency } from '../utils/formatters';

interface SidebarProps {
  activeSection: NavSection;
  onNavigate: (section: NavSection) => void;
  deals: Deal[];
  settings: WorkspaceSettings;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  authUser: {
    email: string;
    role: string;
  };
  onSignOut: () => void;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Revenue Command', icon: LayoutDashboard },
  { id: 'pipeline', label: 'Pipeline Board', icon: Kanban },
  { id: 'deals', label: 'Deals & Accounts', icon: Table2 },
  { id: 'contacts', label: 'Buying Committees', icon: Users },
  { id: 'analytics', label: 'Forecasting', icon: BarChart3 },
  { id: 'spatial', label: '3D Spatial View', icon: Box },
  { id: 'territory', label: 'Territory Intel', icon: Compass },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeSection,
  onNavigate,
  deals,
  settings,
  mobileOpen,
  onCloseMobile,
  authUser,
  onSignOut,
}) => {
  const openDealsCount = deals.filter((d) => d.stage !== 'Closed Won').length;
  const closedWonValue = deals
    .filter((d) => d.stage === 'Closed Won')
    .reduce((sum, d) => sum + d.value, 0);
  const attainmentPct =
    settings.quarterlyQuota > 0
      ? Math.min(100, Math.round((closedWonValue / settings.quarterlyQuota) * 100))
      : 0;

  const handleSelect = (section: NavSection) => {
    onNavigate(section);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[#060e20] border-r border-[#464554]/35 text-[#dae2fd]">
      {/* Brand header */}
      <div className="flex h-16 items-center justify-between px-5 border-b border-[#464554]/30">
        <button
          type="button"
          onClick={() => handleSelect('dashboard')}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] rounded"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded bg-[#6366F1] text-white shrink-0">
            <svg
              width="16"
              height="16"
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
          <span className="text-[15px] font-semibold tracking-[-0.02em] text-[#dae2fd] whitespace-nowrap">
            VijayaEle_CRM
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation"
          className="lg:hidden p-1.5 rounded text-[#908fa0] hover:text-[#dae2fd] hover:bg-[#171f33] transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary navigation */}
      <nav aria-label="Workspace navigation" className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
        <div className="px-2.5 pb-2 text-[11px] font-semibold tracking-[0.05em] text-[#908fa0] uppercase">
          Workspace
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded text-[14px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] ${
                isActive
                  ? 'bg-[#6366F1]/18 text-[#e1e0ff]'
                  : 'text-[#c7c4d7] hover:bg-[#131b2e] hover:text-[#dae2fd]'
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? 'text-[#8083ff]' : 'text-[#908fa0]'
                  }`}
                />
                <span className="truncate whitespace-nowrap">{item.label}</span>
              </span>
              {item.id === 'pipeline' && (
                <span className="rounded-full bg-[#171f33] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#c7c4d7]">
                  {openDealsCount}
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-5">
          <div className="px-2.5 pb-2 text-[11px] font-semibold tracking-[0.05em] text-[#908fa0] uppercase">
            Administration
          </div>
          <button
            type="button"
            onClick={() => handleSelect('settings')}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-[14px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1] ${
              activeSection === 'settings'
                ? 'bg-[#6366F1]/18 text-[#e1e0ff]'
                : 'text-[#c7c4d7] hover:bg-[#131b2e] hover:text-[#dae2fd]'
            }`}
          >
            <Settings
              className={`h-4 w-4 shrink-0 ${
                activeSection === 'settings' ? 'text-[#8083ff]' : 'text-[#908fa0]'
              }`}
            />
            <span className="truncate whitespace-nowrap">Workspace Settings</span>
          </button>
        </div>
      </nav>

      {/* Live Quota Attainment Summary */}
      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={() => handleSelect('analytics')}
          className="w-full text-left rounded-lg bg-[#131b2e] border border-[#464554]/35 p-3.5 hover:border-[#6366F1]/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
        >
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium text-[#c7c4d7]">
              {settings.fiscalQuarter} Attainment
            </span>
            <span className="font-mono text-[12px] font-semibold tabular-nums text-[#4edea3]">
              {attainmentPct}%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-[#222a3d] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#10B981] transition-all duration-300"
              style={{ width: `${attainmentPct}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-[#908fa0] tabular-nums">
            <span>{formatCurrency(closedWonValue, true)} closed</span>
            <span>Goal {formatCurrency(settings.quarterlyQuota, true)}</span>
          </div>
        </button>
      </div>

      {/* Administrator profile & sign out footer */}
      <div className="border-t border-[#464554]/30 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6366F1]/25 text-[12px] font-semibold text-[#c0c1ff] shrink-0 uppercase">
            {authUser.email.slice(0, 2)}
          </div>
          <div className="min-w-0 flex-1">
            <div
              className="text-[13px] font-medium text-[#dae2fd] truncate"
              title={authUser.email}
            >
              {authUser.email}
            </div>
            <div className="text-[12px] text-[#908fa0] truncate">
              {authUser.role}
            </div>
          </div>
          <button
            type="button"
            onClick={onSignOut}
            title="Sign out"
            aria-label="Sign out"
            className="rounded p-1.5 text-[#908fa0] hover:bg-[#171f33] hover:text-[#ffb4ab] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Fixed desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block lg:w-[252px]">
        {sidebarContent}
      </aside>

      {/* Mobile / Tablet off-canvas drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-[#060e20]/80 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-[264px] shadow-2xl">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
