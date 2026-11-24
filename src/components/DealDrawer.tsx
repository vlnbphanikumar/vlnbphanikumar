import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Check,
  Mail,
  MessageSquare,
  Phone,
  Trash2,
  User,
  Video,
  X,
} from 'lucide-react';
import {
  Contact,
  Deal,
  DealHealth,
  DealNote,
  DealStage,
  SalesRep,
  WorkspaceSettings,
} from '../types/crm';
import {
  DEAL_STAGES,
  formatCurrency,
  formatShortDate,
  HEALTH_META,
  STAGE_META,
} from '../utils/formatters';

interface DealDrawerProps {
  deal: Deal | null;
  onClose: () => void;
  reps: SalesRep[];
  contacts: Contact[];
  settings: WorkspaceSettings;
  onUpdateDeal: (dealId: string, updates: Partial<Deal>, logMessage?: string) => void;
  onAddNote: (dealId: string, note: Omit<DealNote, 'id' | 'timestamp'>) => void;
  onDeleteDeal: (dealId: string) => void;
  onInspectContact: (contactId: string) => void;
}

const HEALTH_OPTIONS: DealHealth[] = ['On Track', 'Needs Review', 'At Risk'];
const NOTE_TYPES: Array<DealNote['type']> = ['Note', 'Call', 'Meeting', 'Email'];

export const DealDrawer: React.FC<DealDrawerProps> = ({
  deal,
  onClose,
  reps,
  contacts,
  settings,
  onUpdateDeal,
  onAddNote,
  onDeleteDeal,
  onInspectContact,
}) => {
  const [noteType, setNoteType] = useState<DealNote['type']>('Note');
  const [noteBody, setNoteBody] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [editValue, setEditValue] = useState('');
  const [editNextStep, setEditNextStep] = useState('');
  const [editCloseDate, setEditCloseDate] = useState('');
  const [savedFeedback, setSavedFeedback] = useState(false);

  useEffect(() => {
    if (deal) {
      setEditValue(String(deal.value));
      setEditNextStep(deal.nextStep);
      setEditCloseDate(deal.closeDate);
      setConfirmDelete(false);
      setNoteBody('');
    }
  }, [deal?.id]);

  useEffect(() => {
    if (!deal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deal, onClose]);

  if (!deal) return null;

  const accountContacts = contacts.filter(
    (c) => c.account.toLowerCase() === deal.account.toLowerCase()
  );
  const weightedValue = Math.round((deal.value * deal.probability) / 100);
  const currentStageIdx = DEAL_STAGES.indexOf(deal.stage);

  const handleStageSelect = (stage: DealStage) => {
    if (stage === deal.stage) return;
    const nextProb = settings.stageProbabilities[stage] ?? STAGE_META[stage].defaultProb;
    const nextCategory =
      stage === 'Closed Won'
        ? 'Closed'
        : stage === 'Negotiation'
        ? 'Commit'
        : stage === 'Proposal'
        ? 'Best Case'
        : 'Pipeline';

    onUpdateDeal(
      deal.id,
      {
        stage,
        probability: nextProb,
        forecastCategory: nextCategory,
        health: stage === 'Closed Won' ? 'On Track' : deal.health,
      },
      `Moved stage from ${deal.stage} to ${stage}`
    );
  };

  const handleSaveDetails = (e: React.FormEvent) => {
    e.preventDefault();
    const numericVal = Math.max(1000, Number(editValue) || deal.value);
    onUpdateDeal(
      deal.id,
      {
        value: numericVal,
        nextStep: editNextStep.trim() || deal.nextStep,
        closeDate: editCloseDate || deal.closeDate,
      },
      'Updated commercial terms and next step'
    );
    setSavedFeedback(true);
    setTimeout(() => setSavedFeedback(false), 1600);
  };

  const handleSubmitNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;
    onAddNote(deal.id, {
      type: noteType,
      author: 'Elena Vance',
      content: noteBody.trim(),
    });
    setNoteBody('');
  };

  const noteIcon = (type: DealNote['type']) => {
    switch (type) {
      case 'Call':
        return <Phone className="h-3.5 w-3.5 text-[#4edea3]" />;
      case 'Meeting':
        return <Video className="h-3.5 w-3.5 text-[#adc6ff]" />;
      case 'Email':
        return <Mail className="h-3.5 w-3.5 text-[#c0c1ff]" />;
      default:
        return <MessageSquare className="h-3.5 w-3.5 text-[#908fa0]" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#060e20]/75 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Deal details for ${deal.name}`}
    >
      <div
        className="flex h-full w-full max-w-xl flex-col border-l border-[#464554]/50 bg-[#131b2e] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#464554]/35 bg-[#171f33] px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[12px] text-[#908fa0]">
              <span className="font-mono text-[#c0c1ff]">{deal.code}</span>
              <span aria-hidden="true">·</span>
              <span>{deal.account}</span>
              <span aria-hidden="true">·</span>
              <span>{deal.segment}</span>
            </div>
            <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.01em] text-[#dae2fd] leading-snug">
              {deal.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close deal drawer"
            className="rounded p-1.5 text-[#908fa0] hover:bg-[#222a3d] hover:text-[#dae2fd] transition-colors shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Commercial Snapshot */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-3.5">
              <div className="text-[11px] font-semibold tracking-[0.05em] text-[#908fa0] uppercase">
                Annual Value
              </div>
              <div className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-[#dae2fd]">
                {formatCurrency(deal.value, true)}
              </div>
            </div>
            <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-3.5">
              <div className="text-[11px] font-semibold tracking-[0.05em] text-[#908fa0] uppercase">
                Weighted ARR
              </div>
              <div className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-[#4edea3]">
                {formatCurrency(weightedValue, true)}
              </div>
            </div>
            <div className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-3.5">
              <div className="text-[11px] font-semibold tracking-[0.05em] text-[#908fa0] uppercase">
                Probability
              </div>
              <div className="mt-1 font-mono text-[20px] font-semibold tabular-nums text-[#c0c1ff]">
                {deal.probability}%
              </div>
            </div>
          </div>

          {/* Interactive Stage Stepper */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium text-[#c7c4d7]">
                Pipeline Stage
              </span>
              <span className="text-[12px] text-[#908fa0]">
                Forecast: {deal.forecastCategory}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {DEAL_STAGES.map((stage, idx) => {
                const isCompleted = idx < currentStageIdx;
                const isCurrent = idx === currentStageIdx;
                return (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => handleStageSelect(stage)}
                    className={`flex flex-col items-center justify-center rounded px-1.5 py-2 text-[11px] font-medium transition-colors border ${
                      isCurrent
                        ? stage === 'Closed Won'
                          ? 'bg-[#10B981]/20 border-[#10B981]/60 text-[#4edea3]'
                          : 'bg-[#6366F1]/25 border-[#6366F1] text-[#e1e0ff]'
                        : isCompleted
                        ? 'bg-[#171f33] border-[#6366F1]/35 text-[#c0c1ff] hover:bg-[#222a3d]'
                        : 'bg-[#0b1326] border-[#464554]/35 text-[#908fa0] hover:bg-[#171f33] hover:text-[#dae2fd]'
                    }`}
                  >
                    <span className="truncate w-full text-center">
                      {stage === 'Closed Won' ? 'Won' : stage}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inline Commercial & Ownership Editor */}
          <form
            onSubmit={handleSaveDetails}
            className="rounded-lg border border-[#464554]/35 bg-[#171f33] p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-[#dae2fd]">
                Opportunity Parameters
              </h3>
              <span className="text-[12px] text-[#908fa0]">
                Cycle age: {deal.cycleDays}d · Created {formatShortDate(deal.createdAt)}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[12px] text-[#908fa0] mb-1">
                  ARR Value (USD)
                </label>
                <input
                  type="number"
                  min={1000}
                  step={5000}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="w-full h-9 rounded border border-[#464554]/50 bg-[#131b2e] px-3 font-mono text-[13px] tabular-nums text-[#dae2fd] focus:border-[#6366F1] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] text-[#908fa0] mb-1">
                  Target Close Date
                </label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-[#908fa0]" />
                  <input
                    type="date"
                    value={editCloseDate}
                    onChange={(e) => setEditCloseDate(e.target.value)}
                    className="w-full h-9 rounded border border-[#464554]/50 bg-[#131b2e] pl-8 pr-2.5 font-mono text-[12px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] text-[#908fa0] mb-1">
                  Account Owner
                </label>
                <select
                  value={deal.ownerId}
                  onChange={(e) =>
                    onUpdateDeal(
                      deal.id,
                      { ownerId: e.target.value },
                      `Reassigned owner to ${
                        reps.find((r) => r.id === e.target.value)?.name ?? 'Rep'
                      }`
                    )
                  }
                  className="w-full h-9 rounded border border-[#464554]/50 bg-[#131b2e] px-2.5 text-[13px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none"
                >
                  {reps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[12px] text-[#908fa0] mb-1">
                  Deal Health
                </label>
                <div className="grid grid-cols-3 gap-1">
                  {HEALTH_OPTIONS.map((h) => {
                    const style = HEALTH_META[h];
                    const active = deal.health === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() =>
                          onUpdateDeal(deal.id, { health: h }, `Marked deal health as ${h}`)
                        }
                        className={`h-9 rounded text-[11px] font-medium transition-colors border ${
                          active
                            ? `${style.bg} ${style.text} ${style.border}`
                            : 'border-[#464554]/40 bg-[#131b2e] text-[#908fa0] hover:text-[#dae2fd]'
                        }`}
                      >
                        {h === 'Needs Review' ? 'Review' : h}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[12px] text-[#908fa0] mb-1">
                Next Action
              </label>
              <input
                type="text"
                value={editNextStep}
                onChange={(e) => setEditNextStep(e.target.value)}
                className="w-full h-9 rounded border border-[#464554]/50 bg-[#131b2e] px-3 text-[13px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[12px] text-[#4edea3]">
                {savedFeedback ? 'Changes saved to pipeline' : ''}
              </span>
              <button
                type="submit"
                className="inline-flex h-8 items-center gap-1.5 rounded bg-[#6366F1] px-3.5 text-[12px] font-medium text-white hover:bg-[#5558e6] transition-colors"
              >
                <Check className="h-3.5 w-3.5" />
                Save Updates
              </button>
            </div>
          </form>

          {/* Linked Buying Committee */}
          <div>
            <h3 className="text-[13px] font-semibold text-[#dae2fd] mb-2.5">
              Account Buying Committee ({accountContacts.length})
            </h3>
            {accountContacts.length === 0 ? (
              <div className="rounded-lg border border-[#464554]/30 bg-[#171f33]/60 px-4 py-3 text-[13px] text-[#908fa0]">
                No stakeholders mapped to {deal.account} yet.
              </div>
            ) : (
              <div className="space-y-2">
                {accountContacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => {
                      onInspectContact(contact.id);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3 rounded-lg border border-[#464554]/35 bg-[#171f33] px-3.5 py-2.5 text-left hover:border-[#6366F1]/50 hover:bg-[#222a3d]/70 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold shrink-0 ${contact.avatarBg}`}
                      >
                        {contact.initials}
                      </span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-[#dae2fd] truncate">
                          {contact.name}
                        </div>
                        <div className="text-[12px] text-[#908fa0] truncate">
                          {contact.title}
                        </div>
                      </div>
                    </div>
                    <span className="text-[12px] text-[#adc6ff] whitespace-nowrap shrink-0">
                      {contact.role}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Log Activity + Timeline */}
          <div>
            <h3 className="text-[13px] font-semibold text-[#dae2fd] mb-2.5">
              Deal Activity & Notes
            </h3>

            <form
              onSubmit={handleSubmitNote}
              className="rounded-lg border border-[#464554]/40 bg-[#171f33] p-3.5 space-y-2.5 mb-4"
            >
              <div className="flex items-center gap-1.5">
                {NOTE_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNoteType(t)}
                    className={`rounded px-2.5 py-1 text-[12px] font-medium transition-colors ${
                      noteType === t
                        ? 'bg-[#6366F1]/25 text-[#e1e0ff]'
                        : 'text-[#908fa0] hover:bg-[#222a3d] hover:text-[#dae2fd]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder={`Log a ${noteType.toLowerCase()} for ${deal.account}...`}
                className="w-full rounded border border-[#464554]/45 bg-[#131b2e] px-3 py-2 text-[13px] text-[#dae2fd] placeholder-[#908fa0]/70 focus:border-[#6366F1] focus:outline-none"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!noteBody.trim()}
                  className="h-8 rounded bg-[#222a3d] border border-[#464554]/50 px-3 text-[12px] font-medium text-[#dae2fd] hover:bg-[#2d3449] disabled:opacity-40 transition-colors"
                >
                  Log {noteType}
                </button>
              </div>
            </form>

            <div className="space-y-2.5">
              {deal.notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border border-[#464554]/30 bg-[#171f33]/75 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-2 text-[12px] text-[#908fa0]">
                    <span className="flex items-center gap-1.5 font-medium text-[#c7c4d7]">
                      {noteIcon(note.type)}
                      <span>{note.type}</span>
                      <span aria-hidden="true">·</span>
                      <span className="flex items-center gap-1 text-[#908fa0] font-normal">
                        <User className="h-3 w-3" />
                        {note.author}
                      </span>
                    </span>
                    <span className="tabular-nums text-[11px]">{note.timestamp}</span>
                  </div>
                  <p className="mt-1.5 text-[13px] text-[#dae2fd] leading-relaxed">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Destructive Footer */}
        <div className="flex items-center justify-between border-t border-[#464554]/35 bg-[#0b1326] px-6 py-3.5">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded border border-[#ef4444]/40 bg-[#131b2e] px-3 text-[12px] font-medium text-[#ffb4ab] hover:bg-[#93000a]/30 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Opportunity
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-[#ffb4ab]">
                Remove {deal.code} permanently?
              </span>
              <button
                type="button"
                onClick={() => {
                  onDeleteDeal(deal.id);
                  onClose();
                }}
                className="h-8 rounded bg-[#93000a] px-3 text-[12px] font-medium text-[#ffdad6] hover:bg-[#b91c1c] transition-colors"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="h-8 rounded border border-[#464554]/50 bg-[#131b2e] px-2.5 text-[12px] text-[#c7c4d7] hover:bg-[#222a3d]"
              >
                Cancel
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded border border-[#464554]/50 bg-[#171f33] px-3.5 text-[12px] font-medium text-[#dae2fd] hover:bg-[#222a3d] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
