import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  GripVertical,
  Plus,
  Search,
} from 'lucide-react';
import { Deal, DealHealth, DealStage, SalesRep } from '../types/crm';
import {
  DEAL_STAGES,
  formatCompactDate,
  formatCurrency,
  HEALTH_META,
  STAGE_META,
} from '../utils/formatters';

interface PipelineBoardViewProps {
  deals: Deal[];
  reps: SalesRep[];
  onMoveDealStage: (dealId: string, targetStage: DealStage) => void;
  onSelectDeal: (dealId: string) => void;
  onOpenNewDealInStage: (stage: DealStage) => void;
}

type SortKey = 'value' | 'closeDate' | 'probability';

export const PipelineBoardView: React.FC<PipelineBoardViewProps> = ({
  deals,
  reps,
  onMoveDealStage,
  onSelectDeal,
  onOpenNewDealInStage,
}) => {
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState<string>('all');
  const [healthFilter, setHealthFilter] = useState<DealHealth | 'all'>('all');
  const [sortBy, setSortBy] = useState<SortKey>('value');

  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<DealStage | null>(null);

  const repById = useMemo(() => {
    const map: Record<string, SalesRep> = {};
    reps.forEach((r) => {
      map[r.id] = r;
    });
    return map;
  }, [reps]);

  const filteredDeals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deals
      .filter((d) => {
        if (ownerFilter !== 'all' && d.ownerId !== ownerFilter) return false;
        if (healthFilter !== 'all' && d.health !== healthFilter) return false;
        if (
          q &&
          !d.account.toLowerCase().includes(q) &&
          !d.name.toLowerCase().includes(q) &&
          !d.code.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'value') return b.value - a.value;
        if (sortBy === 'probability') return b.probability - a.probability;
        return a.closeDate.localeCompare(b.closeDate);
      });
  }, [deals, search, ownerFilter, healthFilter, sortBy]);

  const totalVisibleArr = filteredDeals.reduce((sum, d) => sum + d.value, 0);
  const totalWeightedArr = filteredDeals.reduce(
    (sum, d) => sum + Math.round((d.value * d.probability) / 100),
    0
  );

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggedDealId(dealId);
    e.dataTransfer.setData('text/plain', dealId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, stage: DealStage) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedDealId;
    if (id) {
      onMoveDealStage(id, stage);
    }
    setDraggedDealId(null);
    setDragOverStage(null);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#464554]/35 bg-[#171f33] p-4">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#908fa0]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter pipeline deals..."
              className="h-9 w-full rounded border border-[#464554]/50 bg-[#131b2e] pl-9 pr-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0] focus:border-[#6366F1] focus:outline-none"
            />
          </div>

          <select
            aria-label="Filter by owner"
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

          <div className="flex items-center gap-1 rounded bg-[#0b1326] p-1 border border-[#464554]/35">
            {(['all', 'On Track', 'Needs Review', 'At Risk'] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHealthFilter(h)}
                className={`rounded px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-colors ${
                  healthFilter === h
                    ? 'bg-[#222a3d] text-[#dae2fd]'
                    : 'text-[#908fa0] hover:text-[#dae2fd]'
                }`}
              >
                {h === 'all' ? 'All Health' : h === 'Needs Review' ? 'Review' : h}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[12px] shrink-0">
          <div className="flex items-center gap-3 text-[#c7c4d7] tabular-nums">
            <span>
              {filteredDeals.length} deals
            </span>
            <span aria-hidden="true" className="text-[#464554]">·</span>
            <span className="font-mono font-semibold text-[#dae2fd]">
              {formatCurrency(totalVisibleArr, true)} total
            </span>
            <span aria-hidden="true" className="text-[#464554]">·</span>
            <span className="font-mono font-semibold text-[#4edea3]">
              {formatCurrency(totalWeightedArr, true)} weighted
            </span>
          </div>

          <select
            aria-label="Sort cards"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-9 rounded border border-[#464554]/50 bg-[#131b2e] px-2.5 text-[12px] text-[#c7c4d7] focus:border-[#6366F1] focus:outline-none"
          >
            <option value="value">Sort: Highest ARR</option>
            <option value="closeDate">Sort: Nearest Close</option>
            <option value="probability">Sort: Probability</option>
          </select>
        </div>
      </div>

      {/* Horizontal Kanban Lanes */}
      <div className="overflow-x-auto pb-3">
        <div className="grid grid-cols-5 gap-4 min-w-[1160px]">
          {DEAL_STAGES.map((stage, stageIdx) => {
            const stageDeals = filteredDeals.filter((d) => d.stage === stage);
            const stageTotal = stageDeals.reduce((sum, d) => sum + d.value, 0);
            const stageWeighted = stageDeals.reduce(
              (sum, d) => sum + Math.round((d.value * d.probability) / 100),
              0
            );
            const stageStyle = STAGE_META[stage];
            const isDropTarget = dragOverStage === stage;
            const nextStage = DEAL_STAGES[stageIdx + 1];

            return (
              <div
                key={stage}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverStage !== stage) setDragOverStage(stage);
                }}
                onDragLeave={() => {
                  if (dragOverStage === stage) setDragOverStage(null);
                }}
                onDrop={(e) => handleDrop(e, stage)}
                className={`flex flex-col rounded-lg border transition-colors min-h-[560px] ${
                  isDropTarget
                    ? 'border-[#6366F1] bg-[#6366F1]/8'
                    : 'border-[#464554]/35 bg-[#131b2e]'
                }`}
              >
                {/* Persistent Column Header with Value Summary */}
                <div className="border-b border-[#464554]/30 px-3.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: stageStyle.barColor }}
                      />
                      <h2 className="text-[13px] font-semibold text-[#dae2fd] truncate">
                        {stage}
                      </h2>
                      <span className="rounded-full bg-[#222a3d] px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#c7c4d7]">
                        {stageDeals.length}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenNewDealInStage(stage)}
                      title={`Add deal to ${stage}`}
                      aria-label={`Add deal to ${stage}`}
                      className="rounded p-1 text-[#908fa0] hover:bg-[#222a3d] hover:text-[#dae2fd] transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-baseline justify-between font-mono text-[12px] tabular-nums">
                    <span className="font-semibold text-[#dae2fd]">
                      {formatCurrency(stageTotal, true)}
                    </span>
                    <span className="text-[11px] text-[#908fa0]">
                      Wtd {formatCurrency(stageWeighted, true)}
                    </span>
                  </div>
                </div>

                {/* Draggable Deal Cards */}
                <div className="flex-1 p-2.5 space-y-2.5">
                  {stageDeals.length === 0 ? (
                    <div className="flex h-28 items-center justify-center rounded border border-dashed border-[#464554]/40 px-3 text-center text-[12px] text-[#908fa0]">
                      Drop an opportunity here
                    </div>
                  ) : (
                    stageDeals.map((deal) => {
                      const rep = repById[deal.ownerId];
                      const healthStyle = HEALTH_META[deal.health];
                      const isDragging = draggedDealId === deal.id;

                      return (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, deal.id)}
                          onDragEnd={() => {
                            setDraggedDealId(null);
                            setDragOverStage(null);
                          }}
                          onClick={() => onSelectDeal(deal.id)}
                          className={`group cursor-pointer rounded-lg border border-[#464554]/35 bg-[#171f33] p-3.5 hover:border-[#6366F1]/55 hover:bg-[#1b243b] transition-all duration-150 ${
                            isDragging ? 'opacity-45 scale-[0.98]' : ''
                          }`}
                        >
                          {/* Top metadata row */}
                          <div className="flex items-center justify-between gap-2 text-[11px] text-[#908fa0]">
                            <span className="truncate font-medium text-[#c7c4d7]">
                              {deal.account}
                            </span>
                            <GripVertical className="h-3.5 w-3.5 text-[#464554] group-hover:text-[#908fa0] shrink-0 cursor-grab" />
                          </div>

                          {/* Deal Title */}
                          <div className="mt-1 text-[13px] font-semibold text-[#dae2fd] leading-snug line-clamp-2">
                            {deal.name}
                          </div>

                          {/* ARR Value + Probability */}
                          <div className="mt-2.5 flex items-baseline justify-between gap-2">
                            <span className="font-mono text-[15px] font-semibold tabular-nums text-[#dae2fd]">
                              {formatCurrency(deal.value)}
                            </span>
                            <span className="font-mono text-[11px] tabular-nums text-[#908fa0]">
                              {deal.probability}%
                            </span>
                          </div>

                          {/* Next step excerpt */}
                          <p className="mt-2 text-[12px] text-[#908fa0] line-clamp-1">
                            {deal.nextStep}
                          </p>

                          {/* Footer: Health, Close Date, Owner & Quick Advance */}
                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#464554]/25 pt-2.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${healthStyle.bg} ${healthStyle.text} ${healthStyle.border}`}
                              >
                                {deal.health === 'Needs Review' ? 'Review' : deal.health}
                              </span>
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] tabular-nums text-[#908fa0] whitespace-nowrap">
                                <Calendar className="h-3 w-3" />
                                {formatCompactDate(deal.closeDate)}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {rep && (
                                <span
                                  title={rep.name}
                                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-semibold ${rep.avatarBg}`}
                                >
                                  {rep.initials}
                                </span>
                              )}
                              {nextStage && (
                                <button
                                  type="button"
                                  title={`Advance to ${nextStage}`}
                                  aria-label={`Advance ${deal.name} to ${nextStage}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMoveDealStage(deal.id, nextStage);
                                  }}
                                  className="flex h-6 w-6 items-center justify-center rounded bg-[#222a3d] text-[#c7c4d7] hover:bg-[#6366F1] hover:text-white transition-colors"
                                >
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
