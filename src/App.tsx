import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import {
  ActivityEvent,
  Contact,
  Deal,
  DealNote,
  DealStage,
  NavSection,
  WorkspaceSettings,
} from './types/crm';
import {
  INITIAL_ACTIVITIES,
  INITIAL_CONTACTS,
  INITIAL_DEALS,
  INITIAL_REPS,
  INITIAL_SETTINGS,
} from './data/seedData';
import { STAGE_META } from './utils/formatters';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { CommandSearchModal } from './components/CommandSearchModal';
import { NewDealModal } from './components/NewDealModal';
import { NewContactModal } from './components/NewContactModal';
import { DealDrawer } from './components/DealDrawer';
import { DashboardView } from './components/DashboardView';
import { PipelineBoardView } from './components/PipelineBoardView';
import { DealsTableView } from './components/DealsTableView';
import { ContactsView } from './components/ContactsView';
import { AnalyticsView } from './components/AnalyticsView';
import { SpatialPipelineView } from './components/SpatialPipelineView';
import { TerritoryIntelView } from './components/TerritoryIntelView';
import { SettingsView } from './components/SettingsView';
import { VoiceAdvisorPanel } from './components/VoiceAdvisorPanel';
import { AdminAuthScreen, AuthSession } from './components/AdminAuthScreen';

const STORAGE_KEY = 'emergent_crm_state_v1';

interface PersistedState {
  deals: Deal[];
  contacts: Contact[];
  activities: ActivityEvent[];
  settings: WorkspaceSettings;
}

function loadInitialState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (Array.isArray(parsed.deals) && Array.isArray(parsed.contacts)) {
        return {
          deals: parsed.deals,
          contacts: parsed.contacts,
          activities: Array.isArray(parsed.activities)
            ? parsed.activities
            : INITIAL_ACTIVITIES,
          settings: parsed.settings ?? INITIAL_SETTINGS,
        };
      }
    }
  } catch {
    // Fallback to clean seed state if storage is unavailable
  }
  return {
    deals: INITIAL_DEALS,
    contacts: INITIAL_CONTACTS,
    activities: INITIAL_ACTIVITIES,
    settings: INITIAL_SETTINGS,
  };
}

const AVATAR_PALETTE = [
  'bg-[#6366F1]/25 text-[#c0c1ff]',
  'bg-[#10B981]/20 text-[#4edea3]',
  'bg-[#3B82F6]/20 text-[#adc6ff]',
  'bg-[#8083ff]/20 text-[#e1e0ff]',
];

export default function App() {
  const initial = useMemo(() => loadInitialState(), []);

  // Session token is kept strictly in React memory (never persisted to localStorage/sessionStorage)
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);

  const [deals, setDeals] = useState<Deal[]>(initial.deals);
  const [contacts, setContacts] = useState<Contact[]>(initial.contacts);
  const [activities, setActivities] = useState<ActivityEvent[]>(initial.activities);
  const [settings, setSettings] = useState<WorkspaceSettings>(initial.settings);

  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [voiceAdvisorOpen, setVoiceAdvisorOpen] = useState(false);

  const [newDealOpen, setNewDealOpen] = useState(false);
  const [newDealDefaultStage, setNewDealDefaultStage] =
    useState<DealStage>('Qualification');
  const [newContactOpen, setNewContactOpen] = useState(false);

  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    initial.contacts[0]?.id ?? null
  );
  const [tableStageFilter, setTableStageFilter] = useState<DealStage | 'all'>('all');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2800);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Persist workspace state locally
  useEffect(() => {
    try {
      const payload: PersistedState = { deals, contacts, activities, settings };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota errors
    }
  }, [deals, contacts, activities, settings]);

  // Keep the direct /admin/login URL synchronized without triggering page reloads
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!authSession) {
      if (window.location.pathname !== '/admin/login') {
        window.history.replaceState({}, '', '/admin/login');
      }
    } else if (window.location.pathname === '/admin/login') {
      window.history.replaceState({}, '', '/');
    }
  }, [authSession]);

  // Global Cmd+K / Ctrl+K shortcut for Command Search (active only when authenticated)
  useEffect(() => {
    if (!authSession) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [authSession]);

  const handleSignOut = () => {
    const tokenToRevoke = authSession?.token;
    setAuthSession(null);
    setVoiceAdvisorOpen(false);
    setSearchOpen(false);
    setSelectedDealId(null);
    setMobileNavOpen(false);
    if (tokenToRevoke) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokenToRevoke}`,
        },
      }).catch(() => {
        // Ignore network errors on sign out
      });
    }
  };

  const pushActivity = (event: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
    setActivities((prev) => [
      {
        ...event,
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: 'Just now',
      },
      ...prev.slice(0, 29),
    ]);
  };

  const handleMoveDealStage = (dealId: string, targetStage: DealStage) => {
    const targetDeal = deals.find((d) => d.id === dealId);
    if (!targetDeal || targetDeal.stage === targetStage) return;

    const nextProb =
      settings.stageProbabilities[targetStage] ?? STAGE_META[targetStage].defaultProb;
    const nextCategory =
      targetStage === 'Closed Won'
        ? 'Closed'
        : targetStage === 'Negotiation'
        ? 'Commit'
        : targetStage === 'Proposal'
        ? 'Best Case'
        : 'Pipeline';

    const stageNote: DealNote = {
      id: `n-${Date.now()}`,
      type: 'Stage Change',
      author: 'Elena Vance',
      content: `Stage transitioned from ${targetDeal.stage} to ${targetStage}.`,
      timestamp: 'Just now',
    };

    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? {
              ...d,
              stage: targetStage,
              probability: nextProb,
              forecastCategory: nextCategory,
              health: targetStage === 'Closed Won' ? 'On Track' : d.health,
              lastActivity: 'Just now',
              notes: [stageNote, ...d.notes],
            }
          : d
      )
    );

    pushActivity({
      type: targetStage === 'Closed Won' ? 'closed_won' : 'stage',
      actor: 'Elena Vance',
      title: `${targetDeal.account} · ${targetStage}`,
      detail: `Moved "${targetDeal.name}" from ${targetDeal.stage} to ${targetStage}.`,
      dealId,
    });

    showToast(`Moved ${targetDeal.account} to ${targetStage}`);
  };

  const handleUpdateDeal = (
    dealId: string,
    updates: Partial<Deal>,
    logMessage?: string
  ) => {
    const existing = deals.find((d) => d.id === dealId);
    if (!existing) return;

    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? {
              ...d,
              ...updates,
              lastActivity: 'Just now',
            }
          : d
      )
    );

    if (logMessage) {
      pushActivity({
        type: updates.stage === 'Closed Won' ? 'closed_won' : 'stage',
        actor: 'Elena Vance',
        title: `${existing.account} · Updated`,
        detail: logMessage,
        dealId,
      });
    }
  };

  const handleAddDealNote = (
    dealId: string,
    note: Omit<DealNote, 'id' | 'timestamp'>
  ) => {
    const existing = deals.find((d) => d.id === dealId);
    if (!existing) return;

    const newNote: DealNote = {
      ...note,
      id: `n-${Date.now()}`,
      timestamp: 'Just now',
    };

    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId
          ? {
              ...d,
              lastActivity: 'Just now',
              notes: [newNote, ...d.notes],
            }
          : d
      )
    );

    pushActivity({
      type: note.type === 'Call' ? 'call' : 'note',
      actor: note.author,
      title: `${existing.account} · ${note.type}`,
      detail: note.content,
      dealId,
    });

    showToast(`Logged ${note.type.toLowerCase()} on ${existing.account}`);
  };

  const handleCreateDeal = (
    input: Omit<Deal, 'id' | 'code' | 'createdAt' | 'lastActivity' | 'cycleDays' | 'notes'>
  ) => {
    const nextCodeNum = 4175 + deals.length;
    const newDeal: Deal = {
      ...input,
      id: `deal-${Date.now()}`,
      code: `EM-${nextCodeNum}`,
      createdAt: new Date().toISOString().slice(0, 10),
      lastActivity: 'Just now',
      cycleDays: 1,
      notes: [
        {
          id: `n-${Date.now()}`,
          type: 'Note',
          author: 'Elena Vance',
          content: `Opportunity created in ${input.stage} stage.`,
          timestamp: 'Just now',
        },
      ],
    };

    setDeals((prev) => [newDeal, ...prev]);
    pushActivity({
      type: 'deal_created',
      actor: 'Elena Vance',
      title: `${newDeal.account} · New Opportunity`,
      detail: `Added "${newDeal.name}" in ${newDeal.stage}.`,
      dealId: newDeal.id,
    });
    showToast(`Created opportunity for ${newDeal.account}`);
  };

  const handleDeleteDeal = (dealId: string) => {
    const target = deals.find((d) => d.id === dealId);
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
    if (selectedDealId === dealId) setSelectedDealId(null);
    if (target) showToast(`Removed ${target.account} (${target.code})`);
  };

  const handleBulkUpdateDeals = (
    dealIds: string[],
    updates: Partial<Deal>,
    description: string
  ) => {
    const idSet = new Set(dealIds);
    setDeals((prev) =>
      prev.map((d) =>
        idSet.has(d.id) ? { ...d, ...updates, lastActivity: 'Just now' } : d
      )
    );
    pushActivity({
      type: 'stage',
      actor: 'Elena Vance',
      title: 'Bulk Pipeline Update',
      detail: description,
    });
    showToast(description);
  };

  const handleBulkDeleteDeals = (dealIds: string[]) => {
    const idSet = new Set(dealIds);
    setDeals((prev) => prev.filter((d) => !idSet.has(d.id)));
    if (selectedDealId && idSet.has(selectedDealId)) setSelectedDealId(null);
    showToast(`Deleted ${dealIds.length} ${dealIds.length === 1 ? 'deal' : 'deals'}`);
  };

  const handleCreateContact = (
    input: Omit<Contact, 'id' | 'initials' | 'avatarBg' | 'lastContacted'>
  ) => {
    const parts = input.name.split(/\s+/).filter(Boolean);
    const initials =
      parts.length >= 2
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : input.name.slice(0, 2).toUpperCase();

    const newContact: Contact = {
      ...input,
      id: `c-${Date.now()}`,
      initials,
      avatarBg: AVATAR_PALETTE[contacts.length % AVATAR_PALETTE.length],
      lastContacted: 'Just now',
    };

    setContacts((prev) => [newContact, ...prev]);
    setSelectedContactId(newContact.id);
    pushActivity({
      type: 'contact',
      actor: 'Elena Vance',
      title: `${newContact.account} · Stakeholder Mapped`,
      detail: `Added ${newContact.name} (${newContact.role}) to buying committee.`,
    });
    showToast(`Added ${newContact.name} to ${newContact.account}`);
  };

  const handleUpdateContact = (contactId: string, updates: Partial<Contact>) => {
    setContacts((prev) =>
      prev.map((c) => (c.id === contactId ? { ...c, ...updates } : c))
    );
    showToast('Updated stakeholder profile');
  };

  const handleDeleteContact = (contactId: string) => {
    const target = contacts.find((c) => c.id === contactId);
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
    if (selectedContactId === contactId) setSelectedContactId(null);
    if (target) showToast(`Removed ${target.name} from directory`);
  };

  const handleSaveSettings = (
    nextSettings: WorkspaceSettings,
    applyProbabilitiesToOpenDeals: boolean
  ) => {
    setSettings(nextSettings);
    if (applyProbabilitiesToOpenDeals) {
      setDeals((prev) =>
        prev.map((d) =>
          d.stage === 'Closed Won'
            ? d
            : {
                ...d,
                probability:
                  nextSettings.stageProbabilities[d.stage] ?? d.probability,
              }
        )
      );
    }
    showToast('Saved workspace settings');
  };

  const handleExportBackup = () => {
    const snapshot = JSON.stringify(
      { deals, contacts, activities, settings },
      null,
      2
    );
    const blob = new Blob([snapshot], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `emergent-crm-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Exported JSON workspace snapshot');
  };

  const handleResetWorkspace = () => {
    setDeals(INITIAL_DEALS);
    setContacts(INITIAL_CONTACTS);
    setActivities(INITIAL_ACTIVITIES);
    setSettings(INITIAL_SETTINGS);
    setSelectedDealId(null);
    setSelectedContactId(INITIAL_CONTACTS[0]?.id ?? null);
    localStorage.removeItem(STORAGE_KEY);
    showToast('Restored baseline enterprise CRM dataset');
  };

  const selectedDeal = deals.find((d) => d.id === selectedDealId) ?? null;

  const existingAccounts = useMemo(() => {
    const set = new Set<string>();
    deals.forEach((d) => set.add(d.account));
    contacts.forEach((c) => set.add(c.account));
    return Array.from(set).sort();
  }, [deals, contacts]);

  if (!authSession) {
    return (
      <AdminAuthScreen
        onAuthenticated={(session) => {
          setAuthSession(session);
          showToast(`Signed in as ${session.user.email}`);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1326] text-[#dae2fd]">
      <Sidebar
        activeSection={activeSection}
        onNavigate={(sec) => {
          setActiveSection(sec);
          if (sec !== 'deals') setTableStageFilter('all');
        }}
        deals={deals}
        settings={settings}
        mobileOpen={mobileNavOpen}
        onCloseMobile={() => setMobileNavOpen(false)}
        authUser={authSession.user}
        onSignOut={handleSignOut}
      />

      <div className="lg:pl-[252px] flex min-h-screen flex-col">
        <TopBar
          activeSection={activeSection}
          fiscalQuarter={settings.fiscalQuarter}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenVoiceAdvisor={() => setVoiceAdvisorOpen(true)}
          onOpenNewDeal={() => {
            setNewDealDefaultStage('Qualification');
            setNewDealOpen(true);
          }}
          onOpenNewContact={() => setNewContactOpen(true)}
        />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 max-w-[1600px] w-full mx-auto">
          {activeSection === 'dashboard' && (
            <DashboardView
              deals={deals}
              reps={INITIAL_REPS}
              activities={activities}
              settings={settings}
              onSelectDeal={(id) => setSelectedDealId(id)}
              onNavigateWithStageFilter={(stage) => {
                setTableStageFilter(stage);
                setActiveSection('deals');
              }}
              onNavigate={setActiveSection}
            />
          )}

          {activeSection === 'pipeline' && (
            <PipelineBoardView
              deals={deals}
              reps={INITIAL_REPS}
              onMoveDealStage={handleMoveDealStage}
              onSelectDeal={(id) => setSelectedDealId(id)}
              onOpenNewDealInStage={(stage) => {
                setNewDealDefaultStage(stage);
                setNewDealOpen(true);
              }}
            />
          )}

          {activeSection === 'deals' && (
            <DealsTableView
              deals={deals}
              reps={INITIAL_REPS}
              initialStageFilter={tableStageFilter}
              onClearInitialStageFilter={() => setTableStageFilter('all')}
              onSelectDeal={(id) => setSelectedDealId(id)}
              onMoveDealStage={handleMoveDealStage}
              onBulkUpdateDeals={handleBulkUpdateDeals}
              onBulkDeleteDeals={handleBulkDeleteDeals}
              onOpenNewDeal={() => {
                setNewDealDefaultStage('Qualification');
                setNewDealOpen(true);
              }}
            />
          )}

          {activeSection === 'contacts' && (
            <ContactsView
              contacts={contacts}
              deals={deals}
              selectedContactId={selectedContactId}
              onSelectContact={(id) => setSelectedContactId(id)}
              onSelectDeal={(dealId) => setSelectedDealId(dealId)}
              onUpdateContact={handleUpdateContact}
              onDeleteContact={handleDeleteContact}
              onOpenNewContact={() => setNewContactOpen(true)}
            />
          )}

          {activeSection === 'analytics' && (
            <AnalyticsView
              deals={deals}
              reps={INITIAL_REPS}
              settings={settings}
            />
          )}

          {activeSection === 'spatial' && (
            <SpatialPipelineView
              deals={deals}
              reps={INITIAL_REPS}
              settings={settings}
              onOpenDealDrawer={(id) => setSelectedDealId(id)}
            />
          )}

          {activeSection === 'territory' && (
            <TerritoryIntelView
              deals={deals}
              contacts={contacts}
              onSelectDeal={(id) => setSelectedDealId(id)}
              authToken={authSession.token}
              onUnauthorized={handleSignOut}
            />
          )}

          {activeSection === 'settings' && (
            <SettingsView
              settings={settings}
              authToken={authSession.token}
              onUnauthorized={handleSignOut}
              onShowToast={showToast}
              onSaveSettings={handleSaveSettings}
              onExportBackup={handleExportBackup}
              onResetWorkspace={handleResetWorkspace}
            />
          )}
        </main>
      </div>

      {/* Global Overlays */}
      <CommandSearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        deals={deals}
        contacts={contacts}
        onSelectDeal={(id) => setSelectedDealId(id)}
        onSelectContact={(id) => {
          setSelectedContactId(id);
          setActiveSection('contacts');
        }}
        onNavigate={setActiveSection}
      />

      <DealDrawer
        deal={selectedDeal}
        onClose={() => setSelectedDealId(null)}
        reps={INITIAL_REPS}
        contacts={contacts}
        settings={settings}
        onUpdateDeal={handleUpdateDeal}
        onAddNote={handleAddDealNote}
        onDeleteDeal={handleDeleteDeal}
        onInspectContact={(contactId) => {
          setSelectedContactId(contactId);
          setActiveSection('contacts');
        }}
      />

      <NewDealModal
        open={newDealOpen}
        onClose={() => setNewDealOpen(false)}
        reps={INITIAL_REPS}
        settings={settings}
        defaultStage={newDealDefaultStage}
        onCreateDeal={handleCreateDeal}
      />

      <NewContactModal
        open={newContactOpen}
        onClose={() => setNewContactOpen(false)}
        existingAccounts={existingAccounts}
        onCreateContact={handleCreateContact}
      />

      <VoiceAdvisorPanel
        open={voiceAdvisorOpen}
        onClose={() => setVoiceAdvisorOpen(false)}
        deals={deals}
        settings={settings}
        authToken={authSession.token}
        onUnauthorized={handleSignOut}
      />

      {/* Non-intrusive Action Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-lg border border-[#464554]/55 bg-[#171f33] px-4 py-2.5 text-[13px] font-medium text-[#dae2fd] shadow-2xl"
        >
          <CheckCircle2 className="h-4 w-4 text-[#4edea3] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
