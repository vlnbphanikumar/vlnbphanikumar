import { Deal, DealHealth, DealStage } from '../types/crm';

export const DEAL_STAGES: DealStage[] = [
  'Qualification',
  'Discovery',
  'Proposal',
  'Negotiation',
  'Closed Won',
];

export const STAGE_META: Record<
  DealStage,
  {
    shortLabel: string;
    badgeBg: string;
    badgeText: string;
    barColor: string;
    defaultProb: number;
  }
> = {
  Qualification: {
    shortLabel: 'Qualification',
    badgeBg: 'bg-[#222a3d]',
    badgeText: 'text-[#c7c4d7]',
    barColor: '#908fa0',
    defaultProb: 20,
  },
  Discovery: {
    shortLabel: 'Discovery',
    badgeBg: 'bg-[#3B82F6]/15',
    badgeText: 'text-[#adc6ff]',
    barColor: '#4d8eff',
    defaultProb: 40,
  },
  Proposal: {
    shortLabel: 'Proposal',
    badgeBg: 'bg-[#6366F1]/18',
    badgeText: 'text-[#c0c1ff]',
    barColor: '#8083ff',
    defaultProb: 65,
  },
  Negotiation: {
    shortLabel: 'Negotiation',
    badgeBg: 'bg-[#6366F1]/25',
    badgeText: 'text-[#e1e0ff]',
    barColor: '#6366F1',
    defaultProb: 85,
  },
  'Closed Won': {
    shortLabel: 'Closed Won',
    badgeBg: 'bg-[#10B981]/18',
    badgeText: 'text-[#4edea3]',
    barColor: '#10B981',
    defaultProb: 100,
  },
};

export const HEALTH_META: Record<
  DealHealth,
  { bg: string; text: string; border: string }
> = {
  'On Track': {
    bg: 'bg-[#10B981]/14',
    text: 'text-[#4edea3]',
    border: 'border-[#10B981]/25',
  },
  'Needs Review': {
    bg: 'bg-[#3B82F6]/14',
    text: 'text-[#adc6ff]',
    border: 'border-[#3B82F6]/25',
  },
  'At Risk': {
    bg: 'bg-[#ef4444]/14',
    text: 'text-[#ffb4ab]',
    border: 'border-[#ef4444]/25',
  },
};

export function formatCurrency(amount: number, compact = false): string {
  if (compact) {
    if (Math.abs(amount) >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(2)}M`;
    }
    if (Math.abs(amount) >= 1_000) {
      return `$${Math.round(amount / 1_000)}K`;
    }
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatShortDate(isoDate: string): string {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatCompactDate(isoDate: string): string {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function exportDealsToCsv(
  deals: Deal[],
  ownerLookup: Record<string, string>
): void {
  const headers = [
    'Deal ID',
    'Deal Name',
    'Account',
    'Segment',
    'Industry',
    'Stage',
    'ARR Value (USD)',
    'Probability (%)',
    'Weighted Value (USD)',
    'Forecast Category',
    'Health',
    'Owner',
    'Close Date',
    'Next Step',
  ];

  const escapeCell = (v: string | number) => {
    const s = String(v ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = deals.map((d) => [
    d.code,
    d.name,
    d.account,
    d.segment,
    d.industry,
    d.stage,
    d.value,
    d.probability,
    Math.round((d.value * d.probability) / 100),
    d.forecastCategory,
    d.health,
    ownerLookup[d.ownerId] ?? 'Unassigned',
    d.closeDate,
    d.nextStep,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `emergent-pipeline-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
