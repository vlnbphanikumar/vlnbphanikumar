import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  Building2,
  Check,
  Copy,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { BuyingRole, Contact, Deal } from '../types/crm';
import { formatCurrency, STAGE_META } from '../utils/formatters';

interface ContactsViewProps {
  contacts: Contact[];
  deals: Deal[];
  selectedContactId: string | null;
  onSelectContact: (contactId: string) => void;
  onSelectDeal: (dealId: string) => void;
  onUpdateContact: (contactId: string, updates: Partial<Contact>) => void;
  onDeleteContact: (contactId: string) => void;
  onOpenNewContact: () => void;
}

const BUYING_ROLES: Array<BuyingRole | 'all'> = [
  'all',
  'Economic Buyer',
  'Executive Sponsor',
  'Champion',
  'Technical Evaluator',
  'Procurement',
];

const ENGAGEMENT_STYLE: Record<
  Contact['engagementStatus'],
  { bg: string; text: string; border: string }
> = {
  Active: {
    bg: 'bg-[#10B981]/14',
    text: 'text-[#4edea3]',
    border: 'border-[#10B981]/25',
  },
  Warm: {
    bg: 'bg-[#3B82F6]/14',
    text: 'text-[#adc6ff]',
    border: 'border-[#3B82F6]/25',
  },
  Cooling: {
    bg: 'bg-[#ef4444]/14',
    text: 'text-[#ffb4ab]',
    border: 'border-[#ef4444]/25',
  },
};

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  deals,
  selectedContactId,
  onSelectContact,
  onSelectDeal,
  onUpdateContact,
  onDeleteContact,
  onOpenNewContact,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<BuyingRole | 'all'>('all');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNotesFor, setEditingNotesFor] = useState<string | null>(null);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (roleFilter !== 'all' && c.role !== roleFilter) return false;
      if (
        q &&
        !c.name.toLowerCase().includes(q) &&
        !c.account.toLowerCase().includes(q) &&
        !c.title.toLowerCase().includes(q) &&
        !c.email.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [contacts, search, roleFilter]);

  const activeContact =
    contacts.find((c) => c.id === selectedContactId) ?? filteredContacts[0] ?? null;

  const linkedDeals = useMemo(() => {
    if (!activeContact) return [];
    return deals.filter(
      (d) => d.account.toLowerCase() === activeContact.account.toLowerCase()
    );
  }, [activeContact, deals]);

  const handleCopy = (value: string, key: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleStartEditNote = (contact: Contact) => {
    setEditingNotesFor(contact.id);
    setNoteDraft(contact.notes);
  };

  const handleSaveNote = (contactId: string) => {
    onUpdateContact(contactId, {
      notes: noteDraft.trim(),
      lastContacted: 'Just now',
    });
    setEditingNotesFor(null);
  };

  return (
    <div className="space-y-5">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#464554]/35 bg-[#171f33] p-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#908fa0]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stakeholders, accounts, titles..."
              className="h-9 w-full rounded border border-[#464554]/50 bg-[#131b2e] pl-9 pr-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0] focus:border-[#6366F1] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded bg-[#0b1326] p-1 border border-[#464554]/35">
            {BUYING_ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`rounded px-2.5 py-1 text-[12px] font-medium whitespace-nowrap transition-colors ${
                  roleFilter === r
                    ? 'bg-[#222a3d] text-[#dae2fd]'
                    : 'text-[#908fa0] hover:text-[#dae2fd]'
                }`}
              >
                {r === 'all' ? 'All Roles' : r}
              </button>
            ))}
          </div>
        </div>

        <span className="text-[12px] text-[#908fa0] tabular-nums whitespace-nowrap">
          {filteredContacts.length} stakeholders mapped
        </span>
      </div>

      {/* Split-Pane Directory + Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left Directory (7 cols) */}
        <div className="xl:col-span-7 rounded-lg border border-[#464554]/35 bg-[#171f33] overflow-hidden">
          {filteredContacts.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <h3 className="text-[15px] font-semibold text-[#dae2fd]">
                No stakeholders match your filter
              </h3>
              <p className="mt-1 text-[13px] text-[#908fa0]">
                Clear your search or add a new buying committee member.
              </p>
              <button
                type="button"
                onClick={onOpenNewContact}
                className="mt-4 inline-flex h-9 items-center gap-1.5 rounded bg-[#6366F1] px-4 text-[13px] font-medium text-white hover:bg-[#5558e6]"
              >
                <Plus className="h-4 w-4" />
                Add Stakeholder
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#464554]/25">
              {filteredContacts.map((contact) => {
                const isSelected = activeContact?.id === contact.id;
                const eng = ENGAGEMENT_STYLE[contact.engagementStatus];
                return (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => {
                      onSelectContact(contact.id);
                      setEditingNotesFor(null);
                    }}
                    className={`w-full flex items-center justify-between gap-4 px-5 py-3.5 text-left transition-colors ${
                      isSelected
                        ? 'bg-[#6366F1]/14'
                        : 'hover:bg-[#222a3d]/60'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold shrink-0 ${contact.avatarBg}`}
                      >
                        {contact.initials}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[14px] font-medium text-[#dae2fd] truncate">
                            {contact.name}
                          </span>
                          <span className="text-[12px] text-[#908fa0] truncate hidden sm:inline">
                            · {contact.account}
                          </span>
                        </div>
                        <div className="text-[12px] text-[#908fa0] truncate">
                          {contact.title} · {contact.role}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="hidden md:inline text-[12px] text-[#908fa0] tabular-nums whitespace-nowrap">
                        {contact.lastContacted}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${eng.bg} ${eng.text} ${eng.border}`}
                      >
                        {contact.engagementStatus}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Stakeholder Inspector (5 cols) */}
        <div className="xl:col-span-5 rounded-lg border border-[#464554]/35 bg-[#171f33] p-6">
          {!activeContact ? (
            <div className="py-12 text-center text-[13px] text-[#908fa0]">
              Select a stakeholder to inspect buying role, contact details, and linked deals.
            </div>
          ) : (
            <div className="space-y-6">
              {/* Profile Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-full text-[15px] font-semibold shrink-0 ${activeContact.avatarBg}`}
                  >
                    {activeContact.initials}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#dae2fd] truncate">
                      {activeContact.name}
                    </h2>
                    <p className="text-[13px] text-[#c7c4d7] truncate">
                      {activeContact.title}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-[#908fa0]">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{activeContact.account}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-[#c0c1ff]">{activeContact.role}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Engagement Selector */}
              <div className="flex items-center justify-between border-y border-[#464554]/30 py-3">
                <span className="text-[12px] font-medium text-[#908fa0]">
                  Relationship Cadence
                </span>
                <div className="flex items-center gap-1">
                  {(['Active', 'Warm', 'Cooling'] as const).map((status) => {
                    const style = ENGAGEMENT_STYLE[status];
                    const isCurrent = activeContact.engagementStatus === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() =>
                          onUpdateContact(activeContact.id, {
                            engagementStatus: status,
                            lastContacted: 'Just now',
                          })
                        }
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                          isCurrent
                            ? `${style.bg} ${style.text} ${style.border}`
                            : 'border-[#464554]/40 bg-[#131b2e] text-[#908fa0] hover:text-[#dae2fd]'
                        }`}
                      >
                        {status}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Direct Contact Details with Copy */}
              <div className="space-y-2.5 text-[13px]">
                <div className="flex items-center justify-between rounded bg-[#131b2e] border border-[#464554]/30 px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Mail className="h-4 w-4 text-[#908fa0] shrink-0" />
                    <span className="text-[#dae2fd] truncate">{activeContact.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeContact.email, 'email')}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#c0c1ff] hover:bg-[#222a3d] shrink-0"
                  >
                    {copiedField === 'email' ? (
                      <>
                        <Check className="h-3 w-3 text-[#4edea3]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between rounded bg-[#131b2e] border border-[#464554]/30 px-3.5 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Phone className="h-4 w-4 text-[#908fa0] shrink-0" />
                    <span className="font-mono text-[12px] text-[#dae2fd]">
                      {activeContact.phone}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeContact.phone, 'phone')}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[#c0c1ff] hover:bg-[#222a3d] shrink-0"
                  >
                    {copiedField === 'phone' ? (
                      <>
                        <Check className="h-3 w-3 text-[#4edea3]" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-2.5 px-1 text-[12px] text-[#908fa0]">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{activeContact.location}</span>
                  <span aria-hidden="true">·</span>
                  <span>Last touched {activeContact.lastContacted}</span>
                </div>
              </div>

              {/* Stakeholder Context / Editable Notes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#908fa0]">
                    Executive Brief & Notes
                  </h3>
                  {editingNotesFor !== activeContact.id && (
                    <button
                      type="button"
                      onClick={() => handleStartEditNote(activeContact)}
                      className="text-[12px] font-medium text-[#c0c1ff] hover:text-[#e1e0ff]"
                    >
                      Edit
                    </button>
                  )}
                </div>

                {editingNotesFor === activeContact.id ? (
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      className="w-full rounded border border-[#6366F1]/60 bg-[#131b2e] px-3 py-2 text-[13px] text-[#dae2fd] focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingNotesFor(null)}
                        className="h-8 rounded border border-[#464554]/50 bg-[#131b2e] px-3 text-[12px] text-[#c7c4d7]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveNote(activeContact.id)}
                        className="h-8 rounded bg-[#6366F1] px-3 text-[12px] font-medium text-white hover:bg-[#5558e6]"
                      >
                        Save Note
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="rounded bg-[#131b2e] border border-[#464554]/30 px-3.5 py-3 text-[13px] text-[#c7c4d7] leading-relaxed">
                    {activeContact.notes}
                  </p>
                )}
              </div>

              {/* Associated Account Deals */}
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#908fa0] mb-2.5">
                  Associated Opportunities ({linkedDeals.length})
                </h3>
                {linkedDeals.length === 0 ? (
                  <div className="rounded bg-[#131b2e] border border-[#464554]/30 px-3.5 py-3 text-[12px] text-[#908fa0]">
                    No active deals linked to {activeContact.account}.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {linkedDeals.map((deal) => {
                      const stageStyle = STAGE_META[deal.stage];
                      return (
                        <button
                          key={deal.id}
                          type="button"
                          onClick={() => onSelectDeal(deal.id)}
                          className="w-full flex items-center justify-between gap-3 rounded bg-[#131b2e] border border-[#464554]/35 px-3.5 py-2.5 text-left hover:border-[#6366F1]/55 hover:bg-[#222a3d]/70 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Briefcase className="h-4 w-4 text-[#8083ff] shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium text-[#dae2fd] truncate">
                                {deal.name}
                              </div>
                              <div className="text-[11px] text-[#908fa0]">
                                {deal.code} · {deal.stage}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${stageStyle.badgeBg} ${stageStyle.badgeText}`}
                            >
                              {deal.probability}%
                            </span>
                            <span className="font-mono text-[13px] font-semibold tabular-nums text-[#dae2fd]">
                              {formatCurrency(deal.value, true)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Remove stakeholder action */}
              <div className="border-t border-[#464554]/30 pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => onDeleteContact(activeContact.id)}
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-[#ef4444]/40 bg-[#131b2e] px-3 text-[12px] font-medium text-[#ffb4ab] hover:bg-[#93000a]/30 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove Stakeholder
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
