export type DealStage =
  | 'Qualification'
  | 'Discovery'
  | 'Proposal'
  | 'Negotiation'
  | 'Closed Won';

export type DealHealth = 'On Track' | 'Needs Review' | 'At Risk';

export type AccountSegment = 'Strategic' | 'Enterprise' | 'Mid-Market';

export type ForecastCategory = 'Closed' | 'Commit' | 'Best Case' | 'Pipeline';

export type BuyingRole =
  | 'Economic Buyer'
  | 'Champion'
  | 'Technical Evaluator'
  | 'Executive Sponsor'
  | 'Procurement';

export type NavSection =
  | 'dashboard'
  | 'pipeline'
  | 'deals'
  | 'contacts'
  | 'analytics'
  | 'spatial'
  | 'territory'
  | 'settings';

export interface SalesRep {
  id: string;
  name: string;
  initials: string;
  title: string;
  region: string;
  quarterlyQuota: number;
  avatarBg: string;
}

export interface DealNote {
  id: string;
  type: 'Note' | 'Call' | 'Meeting' | 'Email' | 'Stage Change';
  author: string;
  content: string;
  timestamp: string;
}

export interface Deal {
  id: string;
  code: string;
  name: string;
  account: string;
  industry: string;
  segment: AccountSegment;
  value: number;
  stage: DealStage;
  probability: number;
  forecastCategory: ForecastCategory;
  health: DealHealth;
  ownerId: string;
  closeDate: string; // YYYY-MM-DD
  createdAt: string; // YYYY-MM-DD
  lastActivity: string;
  nextStep: string;
  cycleDays: number;
  notes: DealNote[];
}

export interface Contact {
  id: string;
  name: string;
  initials: string;
  title: string;
  account: string;
  role: BuyingRole;
  email: string;
  phone: string;
  location: string;
  lastContacted: string;
  engagementStatus: 'Active' | 'Warm' | 'Cooling';
  avatarBg: string;
  notes: string;
}

export interface ActivityEvent {
  id: string;
  type: 'stage' | 'deal_created' | 'note' | 'call' | 'closed_won' | 'contact';
  actor: string;
  title: string;
  detail: string;
  timestamp: string;
  dealId?: string;
}

export interface WorkspaceSettings {
  organizationName: string;
  fiscalQuarter: string;
  quarterlyQuota: number;
  stageProbabilities: Record<DealStage, number>;
}
