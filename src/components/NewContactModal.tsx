import React, { useState } from 'react';
import { X } from 'lucide-react';
import { BuyingRole, Contact } from '../types/crm';

interface NewContactModalProps {
  open: boolean;
  onClose: () => void;
  existingAccounts: string[];
  onCreateContact: (contact: Omit<Contact, 'id' | 'initials' | 'avatarBg' | 'lastContacted'>) => void;
}

const ROLES: BuyingRole[] = [
  'Economic Buyer',
  'Executive Sponsor',
  'Champion',
  'Technical Evaluator',
  'Procurement',
];

export const NewContactModal: React.FC<NewContactModalProps> = ({
  open,
  onClose,
  existingAccounts,
  onCreateContact,
}) => {
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [account, setAccount] = useState(existingAccounts[0] ?? '');
  const [role, setRole] = useState<BuyingRole>('Champion');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('New York, NY');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !account.trim() || !email.trim()) {
      setError('Full name, account, and email address are required.');
      return;
    }

    onCreateContact({
      name: name.trim(),
      title: title.trim() || 'Director',
      account: account.trim(),
      role,
      email: email.trim(),
      phone: phone.trim() || '+1 (415) 555-0140',
      location: location.trim() || 'San Francisco, CA',
      engagementStatus: 'Active',
      notes: notes.trim() || 'Added to buying committee.',
    });

    setName('');
    setTitle('');
    setEmail('');
    setPhone('');
    setNotes('');
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#060e20]/80 p-4 backdrop-blur-xs"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Add buying committee stakeholder"
    >
      <div
        className="w-full max-w-lg rounded-lg border border-[#464554]/55 bg-[#171f33] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#464554]/35 px-6 py-4">
          <div>
            <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#dae2fd]">
              Add Stakeholder
            </h2>
            <p className="text-[13px] text-[#908fa0]">
              Map an executive or technical evaluator to an account buying committee.
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
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Victoria Chen"
                className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0]/70 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
                Job Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. VP Engineering"
                className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0]/70 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
                Account
              </label>
              <input
                type="text"
                list="existing-accounts-list"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="Select or type account"
                className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0]/70 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
              />
              <datalist id="existing-accounts-list">
                {existingAccounts.map((acc) => (
                  <option key={acc} value={acc} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
                Buying Role
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as BuyingRole)}
                className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-2.5 text-[13px] text-[#dae2fd] focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
                Work Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="v.chen@company.com"
                className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0]/70 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
                Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (415) 555-0192"
                className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-3 font-mono text-[12px] text-[#dae2fd] placeholder-[#908fa0]/70 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Chicago, IL"
              className="w-full h-9 rounded border border-[#464554]/55 bg-[#131b2e] px-3 text-[13px] text-[#dae2fd] placeholder-[#908fa0]/70 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-[#c7c4d7] mb-1.5">
              Stakeholder Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key priorities, evaluation criteria, or relationship context..."
              className="w-full rounded border border-[#464554]/55 bg-[#131b2e] px-3 py-2 text-[13px] text-[#dae2fd] placeholder-[#908fa0]/70 focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/25"
            />
          </div>

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
              Add Stakeholder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
