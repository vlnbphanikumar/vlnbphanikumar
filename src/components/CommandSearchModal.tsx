import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Briefcase, Search, User, X } from 'lucide-react';
import { Contact, Deal, NavSection } from '../types/crm';
import { formatCurrency, STAGE_META } from '../utils/formatters';

interface CommandSearchModalProps {
  open: boolean;
  onClose: () => void;
  deals: Deal[];
  contacts: Contact[];
  onSelectDeal: (dealId: string) => void;
  onSelectContact: (contactId: string) => void;
  onNavigate: (section: NavSection) => void;
}

type SearchResultItem =
  | { kind: 'deal'; id: string; deal: Deal }
  | { kind: 'contact'; id: string; contact: Contact }
  | { kind: 'nav'; id: string; section: NavSection; label: string; hint: string };

const NAV_SHORTCUTS: Array<{ section: NavSection; label: string; hint: string }> = [
  { section: 'dashboard', label: 'Revenue Command', hint: 'Executive KPIs & forecast' },
  { section: 'pipeline', label: 'Pipeline Board', hint: 'Drag-and-drop Kanban stages' },
  { section: 'deals', label: 'Deals & Accounts', hint: 'Sortable enterprise ledger' },
  { section: 'contacts', label: 'Buying Committees', hint: 'Stakeholders & roles' },
  { section: 'analytics', label: 'Forecasting', hint: 'Quota attainment & modeling' },
  { section: 'spatial', label: '3D Spatial View', hint: 'Interactive 3D pipeline towers' },
  { section: 'territory', label: 'Territory Intel', hint: 'Google Maps grounded briefs' },
  { section: 'settings', label: 'Workspace Settings', hint: 'Quotas & stage probabilities' },
];

export const CommandSearchModal: React.FC<CommandSearchModalProps> = ({
  open,
  onClose,
  deals,
  contacts,
  onSelectDeal,
  onSelectContact,
  onNavigate,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const results = useMemo<SearchResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    const items: SearchResultItem[] = [];

    const matchedDeals = deals
      .filter(
        (d) =>
          !q ||
          d.name.toLowerCase().includes(q) ||
          d.account.toLowerCase().includes(q) ||
          d.code.toLowerCase().includes(q) ||
          d.stage.toLowerCase().includes(q)
      )
      .slice(0, q ? 6 : 4);

    matchedDeals.forEach((deal) => items.push({ kind: 'deal', id: deal.id, deal }));

    const matchedContacts = contacts
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          c.account.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          c.role.toLowerCase().includes(q)
      )
      .slice(0, q ? 5 : 3);

    matchedContacts.forEach((contact) =>
      items.push({ kind: 'contact', id: contact.id, contact })
    );

    const matchedNav = NAV_SHORTCUTS.filter(
      (n) =>
        !q ||
        n.label.toLowerCase().includes(q) ||
        n.hint.toLowerCase().includes(q)
    ).slice(0, q ? 4 : 3);

    matchedNav.forEach((n) =>
      items.push({
        kind: 'nav',
        id: `nav-${n.section}`,
        section: n.section,
        label: n.label,
        hint: n.hint,
      })
    );

    return items;
  }, [query, deals, contacts]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const executeItem = (item: SearchResultItem) => {
    if (item.kind === 'deal') {
      onSelectDeal(item.deal.id);
    } else if (item.kind === 'contact') {
      onSelectContact(item.contact.id);
    } else {
      onNavigate(item.section);
    }
    onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) =>
          results.length > 0 ? (prev - 1 + results.length) % results.length : 0
        );
      } else if (e.key === 'Enter' && results[activeIndex]) {
        e.preventDefault();
        executeItem(results[activeIndex]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, results, activeIndex]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#060e20]/80 px-4 pt-20 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Global workspace search"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-lg border border-[#464554]/55 bg-[#171f33] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 border-b border-[#464554]/40 px-4 py-3.5">
          <Search className="h-4 w-4 text-[#8083ff] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search deals, accounts, buying committee, or screens..."
            className="w-full bg-transparent text-[14px] text-[#dae2fd] placeholder-[#908fa0] focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="rounded p-1 text-[#908fa0] hover:bg-[#222a3d] hover:text-[#dae2fd] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-[#908fa0]">
              No matching deals, accounts, or contacts for "{query}".
            </div>
          ) : (
            results.map((item, index) => {
              const isSelected = index === activeIndex;
              if (item.kind === 'deal') {
                const stageStyle = STAGE_META[item.deal.stage];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => executeItem(item)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-[#222a3d]' : 'hover:bg-[#131b2e]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Briefcase className="h-4 w-4 text-[#8083ff] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-[#dae2fd] truncate">
                          {item.deal.account} · {item.deal.name}
                        </div>
                        <div className="text-[12px] text-[#908fa0] truncate">
                          {item.deal.code} · {item.deal.segment}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${stageStyle.badgeBg} ${stageStyle.badgeText}`}
                      >
                        {item.deal.stage}
                      </span>
                      <span className="font-mono text-[13px] font-medium tabular-nums text-[#dae2fd]">
                        {formatCurrency(item.deal.value, true)}
                      </span>
                    </div>
                  </button>
                );
              }

              if (item.kind === 'contact') {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => executeItem(item)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-[#222a3d]' : 'hover:bg-[#131b2e]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <User className="h-4 w-4 text-[#4edea3] shrink-0" />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-[#dae2fd] truncate">
                          {item.contact.name}
                        </div>
                        <div className="text-[12px] text-[#908fa0] truncate">
                          {item.contact.title} · {item.contact.account}
                        </div>
                      </div>
                    </div>
                    <span className="text-[12px] text-[#adc6ff] whitespace-nowrap shrink-0">
                      {item.contact.role}
                    </span>
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => executeItem(item)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSelected ? 'bg-[#222a3d]' : 'hover:bg-[#131b2e]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ArrowRight className="h-4 w-4 text-[#908fa0] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[#dae2fd]">
                        Go to {item.label}
                      </div>
                      <div className="text-[12px] text-[#908fa0]">{item.hint}</div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between border-t border-[#464554]/35 bg-[#131b2e] px-4 py-2 text-[11px] text-[#908fa0]">
          <span>Navigate with ↑ ↓ · Open with Enter</span>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
};
