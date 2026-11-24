import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  PhoneCall,
  Repeat,
  UserPlus,
} from 'lucide-react';
import {
  ActivityEvent,
  Deal,
  DealStage,
  NavSection,
  SalesRep,
  WorkspaceSettings,
} from '../types/crm';
import {
  DEAL_STAGES,
  formatCompactDate,
  formatCurrency,
  HEALTH_META,
  STAGE_META,
} from '../utils/formatters';

interface DashboardViewProps {
  deals: Deal[];
  reps: SalesRep[];
  activities: ActivityEvent[];
  settings: WorkspaceSettings;
  onSelectDeal: (dealId: string) => void;
  onNavigateWithStageFilter: (stage: DealStage) => void;
  onNavigate: (section: NavSection) => void;
}

type ChartWindow = '6M' | 'Q4' | 'FY';

interface ChartPeriod {
  label: string;
  closed: number;
  commit: number;
  bestCase: number;
  quota: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  deals,
  reps,
  activities,
  settings,
  onSelectDeal,
  onNavigateWithStageFilter,
  onNavigate,
}) => {
  const [chartWindow, setChartWindow] = useState<ChartWindow>('6M');
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const repById = useMemo(() => {
    const map: Record<string, SalesRep> = {};
    reps.forEach((r) => {
      map[r.id] = r;
    });
    return map;
  }, [reps]);

  // Live executive metrics derived from real deal state
  const metrics = useMemo(() => {
    const openDeals = deals.filter((d) => d.stage !== 'Closed Won');
    const closedDeals = deals.filter((d) => d.stage === 'Closed Won');

    const closedWonArr = closedDeals.reduce((sum, d) => sum + d.value, 0);
    const openPipelineArr = openDeals.reduce((sum, d) => sum + d.value, 0);
    const weightedOpenArr = openDeals.reduce(
      (sum, d) => sum + (d.value * d.probability) / 100,
      0
    );
    const totalWeightedArr = closedWonArr + weightedOpenArr;
    const remainingQuota = Math.max(1, settings.quarterlyQuota - closedWonArr);
    const coverageRatio = openPipelineArr / remainingQuota;

    const avgCycle =
      deals.length > 0
        ? Math.round(deals.reduce((sum, d) => sum + d.cycleDays, 0) / deals.length)
        : 0;

    const quotaPct =
      settings.quarterlyQuota > 0
        ? Math.round((closedWonArr / settings.quarterlyQuota) * 100)
        : 0;

    return {
      closedWonArr,
      openPipelineArr,
      totalWeightedArr,
      coverageRatio,
      avgCycle,
      quotaPct,
      closedCount: closedDeals.length,
      openCount: openDeals.length,
    };
  }, [deals, settings.quarterlyQuota]);

  // Interactive chart datasets reacting to live Closed Won / Commit / Best Case
  const chartData = useMemo<ChartPeriod[]>(() => {
    const commitArr = deals
      .filter((d) => d.forecastCategory === 'Commit')
      .reduce((s, d) => s + d.value, 0);
    const bestCaseArr = deals
      .filter((d) => d.forecastCategory === 'Best Case')
      .reduce((s, d) => s + d.value, 0);

    if (chartWindow === 'Q4') {
      const mQuota = settings.quarterlyQuota / 3;
      return [
        {
          label: 'Oct 2026',
          closed: Math.round(metrics.closedWonArr * 0.36),
          commit: 0,
          bestCase: 0,
          quota: Math.round(mQuota),
        },
        {
          label: 'Nov 2026',
          closed: Math.round(metrics.closedWonArr * 0.64),
          commit: Math.round(commitArr * 0.25),
          bestCase: Math.round(bestCaseArr * 0.15),
          quota: Math.round(mQuota),
        },
        {
          label: 'Dec 2026',
          closed: 0,
          commit: Math.round(commitArr * 0.75),
          bestCase: Math.round(bestCaseArr * 0.85),
          quota: Math.round(mQuota),
        },
      ];
    }

    if (chartWindow === 'FY') {
      return [
        { label: 'Q1 2026', closed: 3_120_000, commit: 0, bestCase: 0, quota: 3_400_000 },
        { label: 'Q2 2026', closed: 3_680_000, commit: 0, bestCase: 0, quota: 3_800_000 },
        { label: 'Q3 2026', closed: 4_190_000, commit: 0, bestCase: 0, quota: 4_100_000 },
        {
          label: 'Q4 2026',
          closed: metrics.closedWonArr,
          commit: commitArr,
          bestCase: bestCaseArr,
          quota: settings.quarterlyQuota,
        },
      ];
    }

    // Trailing 6M default
    const mQuota = settings.quarterlyQuota / 3;
    return [
      { label: 'Jul', closed: 1_240_000, commit: 0, bestCase: 0, quota: 1_350_000 },
      { label: 'Aug', closed: 1_380_000, commit: 0, bestCase: 0, quota: 1_350_000 },
      { label: 'Sep', closed: 1_570_000, commit: 0, bestCase: 0, quota: 1_400_000 },
      {
        label: 'Oct',
        closed: Math.round(metrics.closedWonArr * 0.36),
        commit: 0,
        bestCase: 0,
        quota: Math.round(mQuota),
      },
      {
        label: 'Nov',
        closed: Math.round(metrics.closedWonArr * 0.64),
        commit: Math.round(commitArr * 0.28),
        bestCase: Math.round(bestCaseArr * 0.12),
        quota: Math.round(mQuota),
      },
      {
        label: 'Dec',
        closed: 0,
        commit: Math.round(commitArr * 0.72),
        bestCase: Math.round(bestCaseArr * 0.88),
        quota: Math.round(mQuota),
      },
    ];
  }, [chartWindow, deals, metrics.closedWonArr, settings.quarterlyQuota]);

  const maxChartVal = useMemo(() => {
    const highest = Math.max(
      ...chartData.map((p) => Math.max(p.closed + p.commit + p.bestCase, p.quota)),
      1
    );
    return highest * 1.15;
  }, [chartData]);

  // Stage breakdown
  const stageBreakdown = useMemo(() => {
    const totalAll = Math.max(
      1,
      deals.reduce((s, d) => s + d.value, 0)
    );
    return DEAL_STAGES.map((stage) => {
      const stageDeals = deals.filter((d) => d.stage === stage);
      const total = stageDeals.reduce((s, d) => s + d.value, 0);
      return {
        stage,
        count: stageDeals.length,
        total,
        share: Math.round((total / totalAll) * 100),
      };
    });
  }, [deals]);

  // Priority open deals (sorted by highest value + at risk surfaced first)
  const priorityDeals = useMemo(() => {
    return deals
      .filter((d) => d.stage !== 'Closed Won')
      .sort((a, b) => {
        const riskA = a.health === 'At Risk' ? 1 : 0;
        const riskB = b.health === 'At Risk' ? 1 : 0;
        if (riskA !== riskB) return riskB - riskA;
        return b.value - a.value;
      })
      .slice(0, 6);
  }, [deals]);

  const activePeriod = hoveredBar !== null ? chartData[hoveredBar] : null;

  const activityIcon = (type: ActivityEvent['type']) => {
    switch (type) {
      case 'closed_won':
        return <CheckCircle2 className="h-4 w-4 text-[#4edea3]" />;
      case 'call':
        return <PhoneCall className="h-4 w-4 text-[#adc6ff]" />;
      case 'stage':
        return <Repeat className="h-4 w-4 text-[#c0c1ff]" />;
      case 'contact':
        return <UserPlus className="h-4 w-4 text-[#4edea3]" />;
      default:
        return <FileText className="h-4 w-4 text-[#908fa0]" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top 4 KPI Metric Cards */}
      <section
        aria-label="Executive revenue metrics"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6"
      >
        {/* KPI 1: Weighted Pipeline */}
        <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[12px] font-medium text-[#c7c4d7]">
              Weighted Forecast
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[#10B981]/14 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#4edea3]">
              <ArrowUpRight className="h-3 w-3" />
              +14.2%
            </span>
          </div>
          <div className="mt-3 font-mono text-[30px] font-semibold leading-[38px] tracking-[-0.02em] tabular-nums text-[#dae2fd]">
            {formatCurrency(metrics.totalWeightedArr, true)}
          </div>
          <div className="mt-3 flex items-center justify-between text-[12px] text-[#908fa0]">
            <span>{metrics.openCount} open · {metrics.closedCount} won</span>
            <svg width="56" height="18" viewBox="0 0 56 18" fill="none" aria-hidden="true">
              <path
                d="M1 14L11 11L21 12.5L32 7L44 8.5L55 2.5"
                stroke="#4edea3"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* KPI 2: Closed Won ARR */}
        <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[12px] font-medium text-[#c7c4d7]">
              Closed Won ARR
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[#10B981]/14 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#4edea3]">
              <ArrowUpRight className="h-3 w-3" />
              {metrics.quotaPct}% quota
            </span>
          </div>
          <div className="mt-3 font-mono text-[30px] font-semibold leading-[38px] tracking-[-0.02em] tabular-nums text-[#dae2fd]">
            {formatCurrency(metrics.closedWonArr, true)}
          </div>
          <div className="mt-3 flex items-center justify-between text-[12px] text-[#908fa0]">
            <span>Target {formatCurrency(settings.quarterlyQuota, true)}</span>
            <svg width="56" height="18" viewBox="0 0 56 18" fill="none" aria-hidden="true">
              <path
                d="M1 15L14 13L25 10L37 9L46 5L55 3"
                stroke="#6366F1"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* KPI 3: Pipeline Coverage */}
        <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[12px] font-medium text-[#c7c4d7]">
              Open Pipeline Coverage
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[#3B82F6]/15 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#adc6ff]">
              <ArrowUpRight className="h-3 w-3" />
              +0.4x
            </span>
          </div>
          <div className="mt-3 font-mono text-[30px] font-semibold leading-[38px] tracking-[-0.02em] tabular-nums text-[#dae2fd]">
            {metrics.coverageRatio.toFixed(1)}x
          </div>
          <div className="mt-3 flex items-center justify-between text-[12px] text-[#908fa0]">
            <span>{formatCurrency(metrics.openPipelineArr, true)} active pipeline</span>
            <svg width="56" height="18" viewBox="0 0 56 18" fill="none" aria-hidden="true">
              <path
                d="M1 12L12 12L23 8.5L35 9.5L45 5.5L55 4.5"
                stroke="#adc6ff"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* KPI 4: Average Sales Cycle */}
        <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-5">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[12px] font-medium text-[#c7c4d7]">
              Avg. Enterprise Cycle
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-[#10B981]/14 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-[#4edea3]">
              <ArrowDownRight className="h-3 w-3" />
              -4 days
            </span>
          </div>
          <div className="mt-3 font-mono text-[30px] font-semibold leading-[38px] tracking-[-0.02em] tabular-nums text-[#dae2fd]">
            {metrics.avgCycle}d
          </div>
          <div className="mt-3 flex items-center justify-between text-[12px] text-[#908fa0]">
            <span>Benchmark 46d · faster close</span>
            <svg width="56" height="18" viewBox="0 0 56 18" fill="none" aria-hidden="true">
              <path
                d="M1 4L14 6.5L26 8L38 11L47 12.5L55 14"
                stroke="#4edea3"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* Main 12-Column Analytical Grid */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Revenue Forecast vs. Quota Chart (8 cols) */}
        <div className="xl:col-span-8 rounded-lg border border-[#464554]/35 bg-[#171f33] p-6 flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#dae2fd]">
                Revenue Forecast vs. Quota
              </h2>
              <p className="mt-0.5 text-[13px] text-[#908fa0]">
                Stacked bookings across Closed Won, Commit, and Best Case against period target.
              </p>
            </div>

            <div className="flex items-center gap-1 rounded bg-[#0b1326] p-1 border border-[#464554]/35">
              {(
                [
                  { id: '6M', label: 'Trailing 6M' },
                  { id: 'Q4', label: 'Q4 Monthly' },
                  { id: 'FY', label: 'FY 2026' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setChartWindow(opt.id);
                    setHoveredBar(null);
                  }}
                  className={`rounded px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-colors ${
                    chartWindow === opt.id
                      ? 'bg-[#222a3d] text-[#dae2fd]'
                      : 'text-[#908fa0] hover:text-[#dae2fd]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Readout / Legend Strip */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-y border-[#464554]/25 py-2.5 text-[12px]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-2 text-[#c7c4d7]">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#10B981]" />
                Closed Won
              </span>
              <span className="flex items-center gap-2 text-[#c7c4d7]">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#6366F1]" />
                Commit
              </span>
              <span className="flex items-center gap-2 text-[#c7c4d7]">
                <span className="h-2.5 w-2.5 rounded-xs bg-[#3B82F6]/65" />
                Best Case
              </span>
              <span className="flex items-center gap-2 text-[#908fa0]">
                <span className="h-0.5 w-3.5 border-t border-dashed border-[#c7c4d7]" />
                Quota
              </span>
            </div>

            <div className="font-mono text-[12px] tabular-nums text-[#dae2fd]">
              {activePeriod ? (
                <span>
                  {activePeriod.label}:{' '}
                  <span className="text-[#4edea3]">
                    {formatCurrency(activePeriod.closed, true)}
                  </span>{' '}
                  won ·{' '}
                  <span className="text-[#c0c1ff]">
                    {formatCurrency(activePeriod.commit, true)}
                  </span>{' '}
                  commit · Goal {formatCurrency(activePeriod.quota, true)}
                </span>
              ) : (
                <span className="text-[#908fa0]">
                  Hover any period bar to inspect exact breakdown
                </span>
              )}
            </div>
          </div>

          {/* Responsive SVG Bar Chart */}
          <div className="mt-5 flex-1 min-h-[250px] flex flex-col justify-end">
            <svg
              viewBox="0 0 680 230"
              className="w-full h-[240px] overflow-visible"
              role="img"
              aria-label="Revenue Forecast vs Quota chart"
            >
              {/* Horizontal gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                const y = 195 - ratio * 175;
                const val = maxChartVal * ratio;
                return (
                  <g key={idx}>
                    <line
                      x1="54"
                      y1={y}
                      x2="668"
                      y2={y}
                      stroke="#464554"
                      strokeOpacity="0.28"
                      strokeWidth="1"
                    />
                    <text
                      x="46"
                      y={y + 4}
                      textAnchor="end"
                      fill="#908fa0"
                      fontSize="11"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {formatCurrency(val, true)}
                    </text>
                  </g>
                );
              })}

              {/* Bars */}
              {chartData.map((period, idx) => {
                const slotWidth = (668 - 64) / chartData.length;
                const barWidth = Math.min(54, slotWidth * 0.48);
                const centerX = 64 + slotWidth * idx + slotWidth / 2;
                const x = centerX - barWidth / 2;

                const closedH = (period.closed / maxChartVal) * 175;
                const commitH = (period.commit / maxChartVal) * 175;
                const bestH = (period.bestCase / maxChartVal) * 175;
                const quotaY = 195 - (period.quota / maxChartVal) * 175;

                const isHovered = hoveredBar === idx;

                return (
                  <g
                    key={period.label}
                    onMouseEnter={() => setHoveredBar(idx)}
                    onMouseLeave={() => setHoveredBar(null)}
                    className="cursor-pointer"
                  >
                    {/* Hover column backdrop */}
                    <rect
                      x={64 + slotWidth * idx + 4}
                      y={16}
                      width={slotWidth - 8}
                      height={180}
                      rx="4"
                      fill="#222a3d"
                      fillOpacity={isHovered ? 0.5 : 0}
                    />

                    {/* Closed Won segment */}
                    {closedH > 0 && (
                      <rect
                        x={x}
                        y={195 - closedH}
                        width={barWidth}
                        height={closedH}
                        rx="2"
                        fill="#10B981"
                        fillOpacity={isHovered ? 1 : 0.9}
                      />
                    )}

                    {/* Commit segment */}
                    {commitH > 0 && (
                      <rect
                        x={x}
                        y={195 - closedH - commitH}
                        width={barWidth}
                        height={commitH}
                        rx="2"
                        fill="#6366F1"
                        fillOpacity={isHovered ? 1 : 0.9}
                      />
                    )}

                    {/* Best Case segment */}
                    {bestH > 0 && (
                      <rect
                        x={x}
                        y={195 - closedH - commitH - bestH}
                        width={barWidth}
                        height={bestH}
                        rx="2"
                        fill="#3B82F6"
                        fillOpacity={isHovered ? 0.85 : 0.55}
                      />
                    )}

                    {/* Quota dashed marker per period */}
                    <line
                      x1={x - 6}
                      y1={quotaY}
                      x2={x + barWidth + 6}
                      y2={quotaY}
                      stroke="#dae2fd"
                      strokeOpacity="0.85"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />

                    {/* X-axis label */}
                    <text
                      x={centerX}
                      y="218"
                      textAnchor="middle"
                      fill={isHovered ? '#dae2fd' : '#908fa0'}
                      fontSize="12"
                      fontWeight={isHovered ? '600' : '500'}
                    >
                      {period.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Pipeline Stage Distribution (4 cols) */}
        <div className="xl:col-span-4 rounded-lg border border-[#464554]/35 bg-[#171f33] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#dae2fd]">
                Stage Distribution
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('pipeline')}
                className="inline-flex items-center gap-1 text-[12px] font-medium text-[#c0c1ff] hover:text-[#e1e0ff] transition-colors whitespace-nowrap"
              >
                Open Board
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-0.5 text-[13px] text-[#908fa0]">
              Click any stage to filter the enterprise deal ledger.
            </p>

            <div className="mt-5 space-y-3.5">
              {stageBreakdown.map((row) => {
                const meta = STAGE_META[row.stage];
                return (
                  <button
                    key={row.stage}
                    type="button"
                    onClick={() => onNavigateWithStageFilter(row.stage)}
                    className="group w-full text-left rounded p-2 -mx-2 hover:bg-[#222a3d]/70 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium text-[#dae2fd] group-hover:text-[#e1e0ff]">
                        {row.stage}
                      </span>
                      <span className="font-mono tabular-nums text-[#dae2fd]">
                        {formatCurrency(row.total, true)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-full bg-[#0b1326] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(4, row.share)}%`,
                          backgroundColor: meta.barColor,
                        }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-[#908fa0] tabular-nums">
                      <span>
                        {row.count} {row.count === 1 ? 'deal' : 'deals'}
                      </span>
                      <span>{row.share}% of total book</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 border-t border-[#464554]/30 pt-3.5 flex items-center justify-between text-[12px]">
            <span className="text-[#908fa0]">Total Book of Business</span>
            <span className="font-mono font-semibold tabular-nums text-[#dae2fd]">
              {formatCurrency(
                deals.reduce((s, d) => s + d.value, 0),
                true
              )}
            </span>
          </div>
        </div>
      </section>

      {/* Bottom 12-Column Operational Row */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Priority Deals Requiring Attention (7 cols) */}
        <div className="xl:col-span-7 rounded-lg border border-[#464554]/35 bg-[#171f33] overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-[#464554]/30 px-6 py-4">
            <div>
              <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#dae2fd]">
                Priority Opportunities
              </h2>
              <p className="text-[12px] text-[#908fa0]">
                Highest-value open deals and accounts requiring executive review.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('deals')}
              className="inline-flex items-center gap-1 text-[12px] font-medium text-[#c0c1ff] hover:text-[#e1e0ff] whitespace-nowrap shrink-0"
            >
              View All Deals
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#464554]/30 bg-[#131b2e] text-[11px] font-semibold uppercase tracking-[0.05em] text-[#908fa0]">
                  <th className="py-2.5 pl-6 pr-3">Account & Opportunity</th>
                  <th className="py-2.5 px-3">Stage</th>
                  <th className="py-2.5 px-3 text-right">ARR</th>
                  <th className="py-2.5 px-3">Health</th>
                  <th className="py-2.5 pl-3 pr-6 text-right">Close</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#464554]/25 text-[13px]">
                {priorityDeals.map((deal, idx) => {
                  const stageStyle = STAGE_META[deal.stage];
                  const healthStyle = HEALTH_META[deal.health];
                  const rep = repById[deal.ownerId];
                  return (
                    <tr
                      key={deal.id}
                      onClick={() => onSelectDeal(deal.id)}
                      className={`cursor-pointer transition-colors hover:bg-[#222a3d]/70 ${
                        idx % 2 === 1 ? 'bg-[#131b2e]/45' : ''
                      }`}
                    >
                      <td className="py-3 pl-6 pr-3 max-w-[230px]">
                        <div className="font-medium text-[#dae2fd] truncate">
                          {deal.account}
                        </div>
                        <div className="text-[12px] text-[#908fa0] truncate">
                          {deal.name} · {rep?.initials ?? 'AE'}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${stageStyle.badgeBg} ${stageStyle.badgeText}`}
                        >
                          {deal.stage}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-medium tabular-nums text-[#dae2fd] whitespace-nowrap">
                        {formatCurrency(deal.value, true)}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${healthStyle.bg} ${healthStyle.text} ${healthStyle.border}`}
                        >
                          {deal.health}
                        </span>
                      </td>
                      <td className="py-3 pl-3 pr-6 text-right font-mono text-[12px] tabular-nums text-[#c7c4d7] whitespace-nowrap">
                        {formatCompactDate(deal.closeDate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live Revenue Activity Feed (5 cols) */}
        <div className="xl:col-span-5 rounded-lg border border-[#464554]/35 bg-[#171f33] flex flex-col">
          <div className="border-b border-[#464554]/30 px-6 py-4">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#dae2fd]">
              Recent Revenue Activity
            </h2>
            <p className="text-[12px] text-[#908fa0]">
              Live deal movements, signed contracts, and stakeholder updates.
            </p>
          </div>

          <div className="divide-y divide-[#464554]/25 flex-1">
            {activities.slice(0, 6).map((act) => (
              <div
                key={act.id}
                onClick={() => act.dealId && onSelectDeal(act.dealId)}
                className={`flex items-start gap-3.5 px-6 py-3.5 ${
                  act.dealId ? 'cursor-pointer hover:bg-[#222a3d]/55 transition-colors' : ''
                }`}
              >
                <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#131b2e] border border-[#464554]/40 shrink-0">
                  {activityIcon(act.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="text-[13px] font-medium text-[#dae2fd] truncate">
                      {act.title}
                    </div>
                    <span className="text-[11px] text-[#908fa0] whitespace-nowrap shrink-0 tabular-nums">
                      {act.timestamp}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[#c7c4d7] line-clamp-2">
                    {act.detail}
                  </p>
                  <div className="mt-1 text-[11px] text-[#908fa0]">
                    {act.actor}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
