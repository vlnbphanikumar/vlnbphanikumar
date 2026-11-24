import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  ChevronRight,
  Download,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  AccountSegment,
  Deal,
  DealStage,
  SalesRep,
} from '../types/crm';
import {
  DEAL_STAGES,
  exportDealsToCsv,
  formatCurrency,
  formatShortDate,
  HEALTH_META,
  STAGE_META,
} from '../utils/formatters';

interface DealsTableViewProps {
  deals: Deal[];
  reps: SalesRep[];
  initialStageFilter: DealStage | 'all';
  onClearInitialStageFilter: () => void;
  onSelectDeal: (dealId: string) => void;
  onMoveDealStage: (dealId: string, targetStage: DealStage) => void;
  onBulkUpdateDeals: (dealIds: string[], updates: Partial<Deal>, description: string) => void;
  onBulkDeleteDeals: (dealIds: string[]) => void;
  onOpenNewDeal: () => void;
}

type SortField = 'account' | 'value' | 'weighted' | 'probability' | 'closeDate';

export const DealsTableView: React.FC<DealsTableViewProps> = ({
  deals,
  reps,
  initialStageFilter,
  onClearInitialStageFilter,
  onSelectDeal,
  onMoveDealStage,
  onBulkUpdateDeals,
  onBulkDeleteDeals,
  onOpenNewDeal,
}) => {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<DealStage | 'all'>(initialStageFilter);
  const [segmentFilter, setSegmentFilter] = useState<AccountSegment | 'all'>('all');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('value');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  React.useEffect(() => {
    setStageFilter(initialStageFilter);
  }, [initialStageFilter]);

  const repById = useMemo(() => {
    const map: Record<string, SalesRep> = {};
    reps.forEach((r) => {
      map[r.id] = r;
    });
    return map;
  }, [reps]);

  const ownerNameLookup = useMemo(() => {
    const map: Record<string, string> = {};
    reps.forEach((r) => {
      map[r.id] = r.name;
    });
    return map;
  }, [reps]);

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals
      .filter((d) => {
        if (stageFilter !== 'all' && d.stage !== stageFilter) return false;
        if (segmentFilter !== 'all' && d.segment !== segmentFilter) return false;
        if (ownerFilter !== 'all' && d.ownerId !== ownerFilter) return false;
        if (
          q &&
          !d.account.toLowerCase().includes(q) &&
          !d.name.toLowerCase().includes(q) &&
          !d.code.toLowerCase().includes(q) &&
          !d.industry.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'account') {
          diff = a.account.localeCompare(b.account);
        } else if (sortField === 'value') {
          diff = a.value - b.value;
        } else if (sortField === 'weighted') {
          diff = a.value * a.probability - b.value * b.probability;
        } else if (sortField === 'probability') {
          diff = a.probability - b.probability;
        } else {
          diff = a.closeDate.localeCompare(b.closeDate);
        }
        return sortDir === 'asc' ? diff : -diff;
      });
  }, [deals, search, stageFilter, segmentFilter, ownerFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'account' || field === 'closeDate' ? 'asc' : 'desc');
    }
  };

  const allVisibleSelected =
    filteredDeals.length > 0 &&
    filteredDeals.every((d) => selectedIds.includes(d.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDeals.map((d) => d.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const resetFilters = () => {
    setSearch('');
    setStageFilter('all');
    setSegmentFilter('all');
    setOwnerFilter('all');
    onClearInitialStageFilter();
  };

  const totalFilteredArr = filteredDeals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-5" onClick={() => openMenuId && setOpenMenuId(null)}>
      {/* Stage Filter Tabs + Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-[#464554]/35 bg-[#131b2e] p-1">
          <button
            type="button"
            onClick={() => {
              setStageFilter('all');
              onClearInitialStageFilter();
            }}
            className={`rounded px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors ${
              stageFilter === 'all'
                ? 'bg-[#6366F1]/22 text-[#e1e0ff]'
                : 'text-[#908fa0] hover:text-[#dae2fd]'
            }`}
          >
            All ({deals.length})
          </button>
          {DEAL_STAGES.map((stage) => {
            const count = deals.filter((d) => d.stage === stage).length;
            const active = stageFilter === stage;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => setStageFilter(stage)}
                className={`rounded px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'bg-[#6366F1]/22 text-[#e1e0ff]'
                    : 'text-[#908fa0] hover:text-[#dae2fd]'
                }`}
              >
                {stage} ({count})
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() =>
            exportDealsToCsv(
              selectedIds.length > 0
                ? deals.filter((d) => selectedIds.includes(d.id))
                : filteredDeals,
              ownerNameLookup
            )
          }
          className="inline-flex h-9 items-center gap-2 rounded border border-[#464554]/50 bg-[#171f33] px-3.5 text-[13px] font-medium text-[#dae2fd] hover:bg-[#222a3d] transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="h-3.5 w-3.5 text-[#c0c1ff]" />
          {selectedIds.length > 0
            ? `Export Selected (${selectedIds.length})`
            : 'Export CSV'}
        </button>
      </div>

      {/* Filter Bar or Contextual Bulk Action Bar */}
      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#6366F1]/50 bg-[#6366F1]/14 px-4 py-3">
          <div className="flex items-center gap-3 text-[13px] font-medium text-[#e1e0ff]">
            <span>{selectedIds.length} opportunities selected</span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-[12px] text-[#c0c1ff] underline underline-offset-2 hover:text-white"
            >
              Clear selection
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Bulk move stage"
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                const nextStage = e.target.value as DealStage;
                onBulkUpdateDeals(
                  selectedIds,
                  {
                    stage: nextStage,
                    probability: STAGE_META[nextStage].defaultProb,
                  },
                  `Moved ${selectedIds.length} deals to ${nextStage}`
                );
                setSelectedIds([]);
              }}
              className="h-8 rounded border border-[#464554]/60 bg-[#131b2e] px-2.5 text-[12px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none"
            >
              <option value="" disabled>
                Move to stage...
              </option>
              {DEAL_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              aria-label="Bulk reassign owner"
              defaultValue=""
              onChange={(e) => {
                if (!e.target.value) return;
                const rep = repById[e.target.value];
                onBulkUpdateDeals(
                  selectedIds,
                  { ownerId: e.target.value },
                  `Reassigned ${selectedIds.length} deals to ${rep?.name ?? 'Rep'}`
                );
                setSelectedIds([]);
              }}
              className="h-8 rounded border border-[#464554]/60 bg-[#131b2e] px-2.5 text-[12px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none"
            >
              <option value="" disabled>
                Reassign owner...
              </option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                onBulkDeleteDeals(selectedIds);
                setSelectedIds([]);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-[#ef4444]/45 bg-[#131b2e] px-3 text-[12px] font-medium text-[#ffb4ab] hover:bg-[#93000a]/35 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#464554]/35 bg-[#171f33] p-3.5">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#908fa0]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search account, deal, industry, or ID..."
                className="h-9 w-full rounded border border-[#464554]/50 bg-[#131b2e] pl-9 pr-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0] focus:border-[#6366F1] focus:outline-none"
              />
            </div>

            <select
              aria-label="Filter by segment"
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value as AccountSegment | 'all')}
              className="h-9 rounded border border-[#464554]/50 bg-[#131b2e] px-2.5 text-[13px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none"
            >
              <option value="all">All Segments</option>
              <option value="Strategic">Strategic</option>
              <option value="Enterprise">Enterprise</option>
              <option value="Mid-Market">Mid-Market</option>
            </select>

            <select
              aria-label="Filter by rep"
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="h-9 rounded border border-[#464554]/50 bg-[#131b2e] px-2.5 text-[13px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none"
            >
              <option value="all">All Owners</option>
              {reps.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <div className="text-[12px] text-[#908fa0] tabular-nums whitespace-nowrap">
            Showing <span className="font-semibold text-[#dae2fd]">{filteredDeals.length}</span>{' '}
            opportunities ·{' '}
            <span className="font-mono font-semibold text-[#dae2fd]">
              {formatCurrency(totalFilteredArr, true)}
            </span>
          </div>
        </div>
      )}

      {/* Dense Data Table */}
      <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] overflow-hidden">
        {filteredDeals.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <h3 className="text-[16px] font-semibold text-[#dae2fd]">
              No matching opportunities
            </h3>
            <p className="mt-1 text-[13px] text-[#908fa0] max-w-md mx-auto">
              Adjust your search terms or active stage and segment filters to see more pipeline records.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={resetFilters}
                className="h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-4 text-[13px] font-medium text-[#dae2fd] hover:bg-[#222a3d]"
              >
                Reset Filters
              </button>
              <button
                type="button"
                onClick={onOpenNewDeal}
                className="inline-flex h-9 items-center gap-1.5 rounded bg-[#6366F1] px-4 text-[13px] font-medium text-white hover:bg-[#5558e6]"
              >
                <Plus className="h-4 w-4" />
                New Deal
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#464554]/35 bg-[#131b2e] text-[11px] font-semibold uppercase tracking-[0.05em] text-[#908fa0]">
                  <th className="w-10 py-3 pl-4 pr-2">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all visible deals"
                      className="h-3.5 w-3.5 rounded border-[#464554] bg-[#0b1326] accent-[#6366F1]"
                    />
                  </th>
                  <th className="py-3 px-3">
                    <button
                      type="button"
                      onClick={() => toggleSort('account')}
                      className="inline-flex items-center gap-1 hover:text-[#dae2fd] whitespace-nowrap"
                    >
                      Account & Opportunity
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 whitespace-nowrap">Segment</th>
                  <th className="py-3 px-3 whitespace-nowrap">Stage</th>
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('value')}
                      className="inline-flex items-center gap-1 hover:text-[#dae2fd] whitespace-nowrap"
                    >
                      ARR Value
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('weighted')}
                      className="inline-flex items-center gap-1 hover:text-[#dae2fd] whitespace-nowrap"
                    >
                      Weighted
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="py-3 px-3 whitespace-nowrap">Health</th>
                  <th className="py-3 px-3 whitespace-nowrap">Owner</th>
                  <th className="py-3 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('closeDate')}
                      className="inline-flex items-center gap-1 hover:text-[#dae2fd] whitespace-nowrap"
                    >
                      Close Date
                      <ArrowUpDown className="h-3 w-3" />
                    </button>
                  </th>
                  <th className="w-12 py-3 pl-2 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#464554]/25 text-[13px]">
                {filteredDeals.map((deal, idx) => {
                  const stageStyle = STAGE_META[deal.stage];
                  const healthStyle = HEALTH_META[deal.health];
                  const rep = repById[deal.ownerId];
                  const weighted = Math.round((deal.value * deal.probability) / 100);
                  const isChecked = selectedIds.includes(deal.id);
                  const stageIdx = DEAL_STAGES.indexOf(deal.stage);
                  const nextStage = DEAL_STAGES[stageIdx + 1];

                  return (
                    <tr
                      key={deal.id}
                      onClick={() => onSelectDeal(deal.id)}
                      className={`cursor-pointer transition-colors hover:bg-[#222a3d]/75 ${
                        isChecked
                          ? 'bg-[#6366F1]/12'
                          : idx % 2 === 1
                          ? 'bg-[#131b2e]/45'
                          : ''
                      }`}
                    >
                      <td
                        className="py-3 pl-4 pr-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(deal.id)}
                          aria-label={`Select ${deal.account}`}
                          className="h-3.5 w-3.5 rounded border-[#464554] bg-[#0b1326] accent-[#6366F1]"
                        />
                      </td>
                      <td className="py-3 px-3 max-w-[280px]">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[#dae2fd] truncate">
                            {deal.account}
                          </span>
                          <span className="font-mono text-[11px] text-[#908fa0] shrink-0">
                            {deal.code}
                          </span>
                        </div>
                        <div className="text-[12px] text-[#908fa0] truncate">
                          {deal.name} · {deal.industry}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-[#c7c4d7] whitespace-nowrap">
                        {deal.segment}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stageStyle.badgeBg} ${stageStyle.badgeText}`}
                        >
                          {deal.stage}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium tabular-nums text-[#dae2fd] whitespace-nowrap">
                        {formatCurrency(deal.value)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#c7c4d7] whitespace-nowrap">
                        {formatCurrency(weighted)}
                        <span className="ml-1 text-[11px] text-[#908fa0]">
                          ({deal.probability}%)
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${healthStyle.bg} ${healthStyle.text} ${healthStyle.border}`}
                        >
                          {deal.health}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {rep && (
                          <div className="flex items-center gap-2">
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold shrink-0 ${rep.avatarBg}`}
                            >
                              {rep.initials}
                            </span>
                            <span className="text-[#c7c4d7]">{rep.name}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[12px] tabular-nums text-[#c7c4d7] whitespace-nowrap">
                        {formatShortDate(deal.closeDate)}
                      </td>
                      <td
                        className="relative py-3 pl-2 pr-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          aria-label={`Row actions for ${deal.account}`}
                          onClick={() =>
                            setOpenMenuId(openMenuId === deal.id ? null : deal.id)
                          }
                          className="rounded p-1.5 text-[#908fa0] hover:bg-[#222a3d] hover:text-[#dae2fd] transition-colors"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>

                        {openMenuId === deal.id && (
                          <div className="absolute right-4 top-10 z-30 w-44 rounded-lg border border-[#464554]/55 bg-[#131b2e] py-1 shadow-xl text-left">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onSelectDeal(deal.id);
                              }}
                              className="w-full flex items-center justify-between px-3 py-2 text-[12px] text-[#dae2fd] hover:bg-[#222a3d]"
                            >
                              Inspect Details
                              <ChevronRight className="h-3.5 w-3.5 text-[#908fa0]" />
                            </button>
                            {nextStage && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onMoveDealStage(deal.id, nextStage);
                                }}
                                className="w-full px-3 py-2 text-[12px] text-[#c0c1ff] hover:bg-[#222a3d]"
                              >
                                Advance to {nextStage}
                              </button>
                            )}
                            <div className="my-1 border-t border-[#464554]/35" />
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onBulkDeleteDeals([deal.id]);
                              }}
                              className="w-full px-3 py-2 text-[12px] text-[#ffb4ab] hover:bg-[#93000a]/30"
                            >
                              Delete Deal
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
