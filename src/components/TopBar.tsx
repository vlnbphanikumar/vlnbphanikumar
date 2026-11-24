import React from 'react';
import { Menu, Mic, Plus, Search } from 'lucide-react';
import { NavSection } from '../types/crm';

interface TopBarProps {
  activeSection: NavSection;
  fiscalQuarter: string;
  onOpenMobileNav: () => void;
  onOpenSearch: () => void;
  onOpenVoiceAdvisor: () => void;
  onOpenNewDeal: () => void;
  onOpenNewContact: () => void;
}

const SECTION_TITLES: Record<NavSection, string> = {
  dashboard: 'Revenue Command',
  pipeline: 'Pipeline Board',
  deals: 'Deals & Accounts',
  contacts: 'Buying Committees',
  analytics: 'Forecasting',
  spatial: '3D Spatial View',
  territory: 'Territory Intel',
  settings: 'Workspace Settings',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeSection,
  fiscalQuarter,
  onOpenMobileNav,
  onOpenSearch,
  onOpenVoiceAdvisor,
  onOpenNewDeal,
  onOpenNewContact,
}) => {
  const isContactsView = activeSection === 'contacts';

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-[#464554]/35 bg-[#0b1326]/95 px-4 sm:px-6 lg:px-8 backdrop-blur-md">
      {/* Left: Mobile menu button + Contextual Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          aria-label="Open workspace navigation"
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded border border-[#464554]/45 bg-[#131b2e] text-[#c7c4d7] hover:bg-[#171f33] hover:text-[#dae2fd] transition-colors shrink-0"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 text-[13px] min-w-0">
          <span className="hidden sm:inline text-[#908fa0] whitespace-nowrap">
            {fiscalQuarter}
          </span>
          <span className="hidden sm:inline text-[#464554]" aria-hidden="true">
            /
          </span>
          <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-[#dae2fd] truncate">
            {SECTION_TITLES[activeSection]}
          </h1>
        </div>
      </div>

      {/* Right: Global Search + Voice Advisor + Primary Action */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-9 items-center gap-2.5 rounded border border-[#464554]/45 bg-[#131b2e] px-3 text-[13px] text-[#908fa0] hover:border-[#6366F1]/50 hover:text-[#dae2fd] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
        >
          <Search className="h-3.5 w-3.5 text-[#908fa0] shrink-0" />
          <span className="hidden md:inline whitespace-nowrap">
            Search deals, accounts, contacts...
          </span>
          <span className="md:hidden whitespace-nowrap">Search</span>
          <kbd className="hidden sm:inline-flex items-center rounded bg-[#222a3d] px-1.5 py-0.5 font-mono text-[11px] font-medium text-[#c7c4d7]">
            ⌘K
          </kbd>
        </button>

        <button
          type="button"
          onClick={onOpenVoiceAdvisor}
          className="inline-flex h-9 items-center gap-1.5 rounded border border-[#464554]/50 bg-[#171f33] px-3 text-[13px] font-medium text-[#dae2fd] hover:border-[#10B981]/55 hover:bg-[#222a3d] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]"
        >
          <Mic className="h-3.5 w-3.5 text-[#4edea3] shrink-0" />
          <span className="hidden sm:inline">Voice Advisor</span>
        </button>

        <button
          type="button"
          onClick={isContactsView ? onOpenNewContact : onOpenNewDeal}
          className="inline-flex h-9 items-center gap-1.5 rounded bg-[#6366F1] px-3.5 text-[13px] font-medium text-white hover:bg-[#5558e6] hover:shadow-[0_2px_12px_rgba(99,102,241,0.35)] transition-all duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c1ff]"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>{isContactsView ? 'Add Contact' : 'New Deal'}</span>
        </button>
      </div>
    </header>
  );
};
