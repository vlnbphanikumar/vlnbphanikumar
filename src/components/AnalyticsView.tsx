import React, { useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { AccountSegment, Deal, SalesRep, WorkspaceSettings } from '../types/crm';
import { formatCurrency } from '../utils/formatters';

interface AnalyticsViewProps {
  deals: Deal[];
  reps: SalesRep[];
  settings: WorkspaceSettings;
}

const SEGMENTS: AccountSegment[] = ['Strategic', 'Enterprise', 'Mid-Market'];

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  deals,
  reps,
  settings,
}) => {
  // Interactive What-If Forecast Scenario controls
  const [commitCloseRate, setCommitCloseRate] = useState(85);
  const [bestCasePullIn, setBestCasePullIn] = useState(45);
  const [earlyPipelinePullIn, setEarlyPipelinePullIn] = useState(15);

  const forecastRollup = useMemo(() => {
    const closedWon = deals
      .filter((d) => d.stage === 'Closed Won')
      .reduce((s, d) => s + d.value, 0);
    const commit = deals
      .filter((d) => d.stage !== 'Closed Won' && d.forecastCategory === 'Commit')
      .reduce((s, d) => s + d.value, 0);
    const bestCase = deals
      .filter((d) => d.stage !== 'Closed Won' && d.forecastCategory === 'Best Case')
      .reduce((s, d) => s + d.value, 0);
    const earlyPipeline = deals
      .filter((d) => d.stage !== 'Closed Won' && d.forecastCategory === 'Pipeline')
      .reduce((s, d) => s + d.value, 0);

    const modeledTotal =
      closedWon +
      Math.round((commit * commitCloseRate) / 100) +
      Math.round((bestCase * bestCasePullIn) / 100) +
      Math.round((earlyPipeline * earlyPipelinePullIn) / 100);

    const variance = modeledTotal - settings.quarterlyQuota;
    const attainment =
      settings.quarterlyQuota > 0
        ? Math.round((modeledTotal / settings.quarterlyQuota) * 100)
        : 0;

    return {
      closedWon,
      commit,
      bestCase,
      earlyPipeline,
      modeledTotal,
      variance,
      attainment,
    };
  }, [deals, settings.quarterlyQuota, commitCloseRate, bestCasePullIn, earlyPipelinePullIn]);

  const repMetrics = useMemo(() => {
    return reps
      .map((rep) => {
        const repDeals = deals.filter((d) => d.ownerId === rep.id);
        const closed = repDeals
          .filter((d) => d.stage === 'Closed Won')
          .reduce((s, d) => s + d.value, 0);
        const open = repDeals
          .filter((d) => d.stage !== 'Closed Won')
          .reduce((s, d) => s + d.value, 0);
        const commit = repDeals
          .filter((d) => d.stage !== 'Closed Won' && d.forecastCategory === 'Commit')
          .reduce((s, d) => s + d.value, 0);
        const attainment = Math.round((closed / rep.quarterlyQuota) * 100);
        const projectedAttainment = Math.round(
          ((closed + commit) / rep.quarterlyQuota) * 100
        );
        const remaining = Math.max(1, rep.quarterlyQuota - closed);
        const coverage = open / remaining;

        return {
          rep,
          dealCount: repDeals.length,
          closed,
          commit,
          open,
          attainment,
          projectedAttainment,
          coverage,
        };
      })
      .sort((a, b) => b.projectedAttainment - a.projectedAttainment);
  }, [deals, reps]);

  const segmentMetrics = useMemo(() => {
    return SEGMENTS.map((seg) => {
      const segDeals = deals.filter((d) => d.segment === seg);
      const total = segDeals.reduce((s, d) => s + d.value, 0);
      const weighted = segDeals.reduce(
        (s, d) => s + Math.round((d.value * d.probability) / 100),
        0
      );
      const won = segDeals.filter((d) => d.stage === 'Closed Won').length;
      const avgSize = segDeals.length > 0 ? Math.round(total / segDeals.length) : 0;
      const avgCycle =
        segDeals.length > 0
          ? Math.round(segDeals.reduce((s, d) => s + d.cycleDays, 0) / segDeals.length)
          : 0;
      return {
        segment: seg,
        count: segDeals.length,
        won,
        total,
        weighted,
        avgSize,
        avgCycle,
      };
    });
  }, [deals]);

  const resetModel = () => {
    setCommitCloseRate(85);
    setBestCasePullIn(45);
    setEarlyPipelinePullIn(15);
  };

  return (
    <div className="space-y-6">
      {/* Forecast Category Rollup Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#908fa0]">
            {settings.fiscalQuarter} Quota
          </div>
          <div className="mt-2 font-mono text-[24px] font-semibold tabular-nums text-[#dae2fd]">
            {formatCurrency(settings.quarterlyQuota, true)}
          </div>
          <div className="mt-1 text-[12px] text-[#908fa0]">Board revenue plan</div>
        </div>

        <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#4edea3]">
            Closed Won
          </div>
          <div className="mt-2 font-mono text-[24px] font-semibold tabular-nums text-[#dae2fd]">
            {formatCurrency(forecastRollup.closedWon, true)}
          </div>
          <div className="mt-1 text-[12px] text-[#908fa0] tabular-nums">
            {Math.round((forecastRollup.closedWon / Math.max(1, settings.quarterlyQuota)) * 100)}% of quota booked
          </div>
        </div>

        <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#c0c1ff]">
            Commit Rollup
          </div>
          <div className="mt-2 font-mono text-[24px] font-semibold tabular-nums text-[#dae2fd]">
            {formatCurrency(forecastRollup.commit, true)}
          </div>
          <div className="mt-1 text-[12px] text-[#908fa0]">Late-stage negotiation</div>
        </div>

        <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#adc6ff]">
            Best Case Upside
          </div>
          <div className="mt-2 font-mono text-[24px] font-semibold tabular-nums text-[#dae2fd]">
            {formatCurrency(forecastRollup.bestCase, true)}
          </div>
          <div className="mt-1 text-[12px] text-[#908fa0]">Proposal & executive review</div>
        </div>

        <div className="rounded-lg border border-[#6366F1]/45 bg-[#171f33] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[#e1e0ff]">
            Modeled Landing
          </div>
          <div className="mt-2 font-mono text-[24px] font-semibold tabular-nums text-[#dae2fd]">
            {formatCurrency(forecastRollup.modeledTotal, true)}
          </div>
          <div
            className={`mt-1 font-mono text-[12px] font-medium tabular-nums ${
              forecastRollup.variance >= 0 ? 'text-[#4edea3]' : 'text-[#ffb4ab]'
            }`}
          >
            {forecastRollup.variance >= 0 ? '+' : ''}
            {formatCurrency(forecastRollup.variance, true)} ({forecastRollup.attainment}%)
          </div>
        </div>
      </section>

      {/* Main 12-Col Attainment & Scenario Grid */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Rep Quota Attainment (7 cols) */}
        <div className="xl:col-span-7 rounded-lg border border-[#464554]/35 bg-[#171f33] overflow-hidden">
          <div className="border-b border-[#464554]/30 px-6 py-4">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#dae2fd]">
              Account Executive Attainment
            </h2>
            <p className="text-[12px] text-[#908fa0]">
              Booked Closed Won (emerald) plus Commit forecast (indigo) against individual quarterly quota.
            </p>
          </div>

          <div className="divide-y divide-[#464554]/25">
            {repMetrics.map((row) => {
              const closedBar = Math.min(100, row.attainment);
              const commitBar = Math.min(
                100 - closedBar,
                Math.max(0, row.projectedAttainment - closedBar)
              );
              return (
                <div key={row.rep.id} className="px-6 py-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold shrink-0 ${row.rep.avatarBg}`}
                      >
                        {row.rep.initials}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[14px] font-medium text-[#dae2fd] truncate">
                          {row.rep.name}
                        </div>
                        <div className="text-[12px] text-[#908fa0] truncate">
                          {row.rep.title} · {row.rep.region}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-5 font-mono text-[12px] tabular-nums">
                      <div className="text-right">
                        <div className="text-[#4edea3] font-semibold">
                          {formatCurrency(row.closed, true)}
                        </div>
                        <div className="text-[11px] text-[#908fa0]">Closed</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[#c0c1ff] font-semibold">
                          {formatCurrency(row.commit, true)}
                        </div>
                        <div className="text-[11px] text-[#908fa0]">Commit</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[#dae2fd] font-semibold">
                          {row.coverage.toFixed(1)}x
                        </div>
                        <div className="text-[11px] text-[#908fa0]">Coverage</div>
                      </div>
                      <div className="text-right min-w-[54px]">
                        <div className="text-[#dae2fd] font-semibold">
                          {row.projectedAttainment}%
                        </div>
                        <div className="text-[11px] text-[#908fa0]">
                          / {formatCurrency(row.rep.quarterlyQuota, true)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stacked progress bar */}
                  <div className="h-2 w-full rounded-full bg-[#0b1326] overflow-hidden flex">
                    <div
                      className="h-full bg-[#10B981] transition-all duration-300"
                      style={{ width: `${closedBar}%` }}
                    />
                    <div
                      className="h-full bg-[#6366F1] transition-all duration-300"
                      style={{ width: `${commitBar}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Interactive What-If Forecast Simulator (5 cols) */}
        <div className="xl:col-span-5 rounded-lg border border-[#464554]/35 bg-[#171f33] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#dae2fd]">
                  Forecast Scenario Modeler
                </h2>
                <p className="mt-0.5 text-[12px] text-[#908fa0]">
                  Stress-test quarterly landing under different conversion assumptions.
                </p>
              </div>
              <button
                type="button"
                onClick={resetModel}
                className="inline-flex h-8 items-center gap-1 rounded border border-[#464554]/50 bg-[#131b2e] px-2.5 text-[12px] text-[#c7c4d7] hover:bg-[#222a3d] hover:text-[#dae2fd]"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>

            <div className="mt-6 space-y-5">
              {/* Slider 1 */}
              <div>
                <div className="flex items-center justify-between text-[13px] mb-1.5">
                  <span className="text-[#dae2fd] font-medium">
                    Commit Conversion Rate
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-[#c0c1ff]">
                    {commitCloseRate}% ·{' '}
                    {formatCurrency(
                      Math.round((forecastRollup.commit * commitCloseRate) / 100),
                      true
                    )}
                  </span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={100}
                  step={5}
                  value={commitCloseRate}
                  onChange={(e) => setCommitCloseRate(Number(e.target.value))}
                  className="w-full accent-[#6366F1] cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-[#908fa0]">
                  <span>Conservative (40%)</span>
                  <span>Full Commit (100%)</span>
                </div>
              </div>

              {/* Slider 2 */}
              <div>
                <div className="flex items-center justify-between text-[13px] mb-1.5">
                  <span className="text-[#dae2fd] font-medium">
                    Best Case Pull-In Rate
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-[#adc6ff]">
                    {bestCasePullIn}% ·{' '}
                    {formatCurrency(
                      Math.round((forecastRollup.bestCase * bestCasePullIn) / 100),
                      true
                    )}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={bestCasePullIn}
                  onChange={(e) => setBestCasePullIn(Number(e.target.value))}
                  className="w-full accent-[#3B82F6] cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-[#908fa0]">
                  <span>None (0%)</span>
                  <span>Upside Capture (100%)</span>
                </div>
              </div>

              {/* Slider 3 */}
              <div>
                <div className="flex items-center justify-between text-[13px] mb-1.5">
                  <span className="text-[#dae2fd] font-medium">
                    Early Pipeline Acceleration
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-[#4edea3]">
                    {earlyPipelinePullIn}% ·{' '}
                    {formatCurrency(
                      Math.round((forecastRollup.earlyPipeline * earlyPipelinePullIn) / 100),
                      true
                    )}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={5}
                  value={earlyPipelinePullIn}
                  onChange={(e) => setEarlyPipelinePullIn(Number(e.target.value))}
                  className="w-full accent-[#10B981] cursor-pointer"
                />
                <div className="flex justify-between text-[11px] text-[#908fa0]">
                  <span>0%</span>
                  <span>Aggressive (60%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Scenario Outcome Readout */}
          <div className="mt-6 rounded-lg border border-[#464554]/40 bg-[#131b2e] p-4">
            <div className="flex items-center justify-between text-[12px] text-[#908fa0]">
              <span>Projected {settings.fiscalQuarter} Attainment</span>
              <span
                className={`font-mono font-semibold tabular-nums ${
                  forecastRollup.attainment >= 100 ? 'text-[#4edea3]' : 'text-[#ffb4ab]'
                }`}
              >
                {forecastRollup.attainment}% of plan
              </span>
            </div>
            <div className="mt-2 h-2.5 w-full rounded-full bg-[#0b1326] overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  forecastRollup.attainment >= 100 ? 'bg-[#10B981]' : 'bg-[#6366F1]'
                }`}
                style={{ width: `${Math.min(100, forecastRollup.attainment)}%` }}
              />
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-[13px] text-[#c7c4d7]">Projected Total ARR</span>
              <span className="font-mono text-[20px] font-semibold tabular-nums text-[#dae2fd]">
                {formatCurrency(forecastRollup.modeledTotal)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Segment Breakdown Table */}
      <section className="rounded-lg border border-[#464554]/35 bg-[#171f33] overflow-hidden">
        <div className="border-b border-[#464554]/30 px-6 py-4">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[#dae2fd]">
            Revenue Velocity by Market Segment
          </h2>
          <p className="text-[12px] text-[#908fa0]">
            Comparative ARR concentration, weighted forecast, and sales cycle length across enterprise tiers.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#464554]/30 bg-[#131b2e] text-[11px] font-semibold uppercase tracking-[0.05em] text-[#908fa0]">
                <th className="py-3 pl-6 pr-3">Segment</th>
                <th className="py-3 px-3 text-right">Opportunities</th>
                <th className="py-3 px-3 text-right">Closed Won</th>
                <th className="py-3 px-3 text-right">Total Book ARR</th>
                <th className="py-3 px-3 text-right">Weighted Forecast</th>
                <th className="py-3 px-3 text-right">Avg. Deal Size</th>
                <th className="py-3 pl-3 pr-6 text-right">Avg. Cycle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#464554]/25 text-[13px]">
              {segmentMetrics.map((m, idx) => (
                <tr key={m.segment} className={idx % 2 === 1 ? 'bg-[#131b2e]/45' : ''}>
                  <td className="py-3.5 pl-6 pr-3 font-medium text-[#dae2fd]">
                    {m.segment}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#c7c4d7]">
                    {m.count}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#4edea3]">
                    {m.won}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono font-medium tabular-nums text-[#dae2fd]">
                    {formatCurrency(m.total)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#c0c1ff]">
                    {formatCurrency(m.weighted)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-mono tabular-nums text-[#c7c4d7]">
                    {formatCurrency(m.avgSize)}
                  </td>
                  <td className="py-3.5 pl-3 pr-6 text-right font-mono tabular-nums text-[#c7c4d7]">
                    {m.avgCycle} days
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
