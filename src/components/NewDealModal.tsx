import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  AccountSegment,
  Deal,
  DealHealth,
  DealStage,
  ForecastCategory,
  SalesRep,
  WorkspaceSettings,
} from '../types/crm';
import { DEAL_STAGES, formatCurrency } from '../utils/formatters';

interface NewDealModalProps {
  open: boolean;
  onClose: () => void;
  reps: SalesRep[];
  settings: WorkspaceSettings;
  defaultStage?: DealStage;
  onCreateDeal: (deal: Omit<Deal, 'id' | 'code' | 'createdAt' | 'lastActivity' | 'cycleDays' | 'notes'>) => void;
}

const SEGMENTS: AccountSegment[] = ['Strategic', 'Enterprise', 'Mid-Market'];
const HEALTH_OPTIONS: DealHealth[] = ['On Track', 'Needs Review', 'At Risk'];

function deriveForecastCategory(stage: DealStage): ForecastCategory {
  if (stage === 'Closed Won') return 'Closed';
  if (stage === 'Negotiation') return 'Commit';
  if (stage === 'Proposal') return 'Best Case';
  return 'Pipeline';
}

export const NewDealModal: React.FC<NewDealModalProps> = ({
  open,
  onClose,
  reps,
  settings,
  defaultStage = 'Qualification',
  onCreateDeal,
}) => {
  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('Enterprise SaaS');
  const [segment, setSegment] = useState<AccountSegment>('Enterprise');
  const [valueInput, setValueInput] = useState('250000');
  const [stage, setStage] = useState<DealStage>(defaultStage);
  const [ownerId, setOwnerId] = useState(reps[0]?.id ?? 'rep-1');
  const [health, setHealth] = useState<DealHealth>('On Track');
  const [closeDate, setCloseDate] = useState('2026-12-20');
  const [nextStep, setNextStep] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStage(defaultStage);
      setError('');
    }
  }, [open, defaultStage]);

  if (!open) return null;

  const numericValue = Math.max(0, Number(valueInput.replace(/[^0-9.]/g, '')) || 0);
  const probability = settings.stageProbabilities[stage] ?? 40;
  const weightedValue = Math.round((numericValue * probability) / 100);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!account.trim() || !name.trim()) {
      setError('Account name and opportunity title are required.');
      return;
    }
    if (numericValue <= 0) {
      setError('Enter an ARR value greater than $0.');
      return;
    }

    onCreateDeal({
      account: account.trim(),
      name: name.trim(),
      industry: industry.trim() || 'Technology',
      segment,
      value: numericValue,
      stage,
      probability,
      forecastCategory: deriveForecastCategory(stage),
      health,
      ownerId,
      closeDate,
      nextStep: nextStep.trim() || 'Schedule technical discovery call',
    });

    setAccount('');
    setName('');
    setNextStep('');
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#060e20]/80 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Create new enterprise deal"
    >
      <div
        className="w-full max-w-lg rounded-lg border border-[#464554]/55 bg-[#171f33] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#464554]/35 px-6 py-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#dae2fd]">
              Create Opportunity
            </h2>
            <p className="text-[13px] text-[#908fa0]">
              Add a new enterprise deal to the {settings.fiscalQuarter} pipeline.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded p-1.5 text-[#908fa0] hover:bg-[#222a3d] hover:text-[#dae2fd] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded border border-[#ef4444]/40 bg-[#93000a]/30 px-3.5 py-2.5 text-[13px] text-[#ffb4ab]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
                Account Name
              </label>
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="e.g. Lattice Photonics"
                className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0]/70 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
                Industry
              </label>
              <input
                type="text"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="e.g. Financial Services"
                className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0]/70 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
              Deal Title
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Enterprise Telemetry Expansion (800 Seats)"
              className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0]/70 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
                ARR Value (USD)
              </label>
              <input
                type="number"
                min={1000}
                step={5000}
                value={valueInput}
                onChange={(e) => setValueInput(e.target.value)}
                className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-3 font-mono text-[13px] tabular-nums text-[#dae2fd] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
                Pipeline Stage
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as DealStage)}
                className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-2.5 text-[13px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
              >
                {DEAL_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
                Segment
              </label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value as AccountSegment)}
                className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-2.5 text-[13px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
              >
                {SEGMENTS.map((seg) => (
                  <option key={seg} value={seg}>
                    {seg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
                Account Owner
              </label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-2.5 text-[13px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
              >
                {reps.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
                Target Close
              </label>
              <input
                type="date"
                value={closeDate}
                onChange={(e) => setCloseDate(e.target.value)}
                className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-2.5 font-mono text-[12px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
                Deal Health
              </label>
              <select
                value={health}
                onChange={(e) => setHealth(e.target.value as DealHealth)}
                className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-2.5 text-[13px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
              >
                {HEALTH_OPTIONS.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
              Immediate Next Step
            </label>
            <input
              type="text"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="e.g. Confirm security review timeline with CISO"
              className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0]/70 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
            />
          </div>

          {/* Weighted Forecast Preview */}
          <div className="flex items-center justify-between rounded bg-[#131b2e] border border-[#464554]/35 px-4 py-3 text-[13px]">
            <span className="text-[#c7c4d7]">
              Weighted Forecast ({probability}% stage probability)
            </span>
            <span className="font-mono font-semibold tabular-nums text-[#4edea3]">
              {formatCurrency(weightedValue)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-4 text-[13px] font-medium text-[#c7c4d7] hover:bg-[#222a3d] hover:text-[#dae2fd] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 rounded bg-[#6366F1] px-4 text-[13px] font-medium text-white hover:bg-[#5558e6] transition-colors"
            >
              Create Opportunity
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
