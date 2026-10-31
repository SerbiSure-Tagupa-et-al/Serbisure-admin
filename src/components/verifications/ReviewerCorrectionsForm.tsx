import React, { useState } from 'react';
import { fetchReviewerCorrections, saveReviewerCorrections } from '../../api/adminApi';
import type { ReviewerCorrectionDetails } from '../../api/adminApi';
import { buildCorrectionPatch, correctionErrorMessage } from '../../data/reviewerCorrections';

const IDENTITY_FIELDS = [
  ['first_name', 'First name'], ['middle_name', 'Middle name'],
  ['last_name', 'Last name'], ['date_of_birth', 'Birthdate'],
] as const;

export const ReviewerCorrectionsForm: React.FC<{ documentId: string; onSaved: () => Promise<void> }> = ({ documentId, onSaved }) => {
  const [original, setOriginal] = useState<ReviewerCorrectionDetails | null>(null);
  const [draft, setDraft] = useState<ReviewerCorrectionDetails | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const open = async () => {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const details = await fetchReviewerCorrections(documentId);
      setOriginal(details);
      setDraft({ ...details, profile: { ...details.profile }, document: { ...details.document } });
      setEditing(true);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not load these details.'); }
    finally { setBusy(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !draft || !original) return;
    const patch = buildCorrectionPatch(original, draft);
    if (!patch) { setNotice('No changes to save.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await saveReviewerCorrections(documentId, patch);
      setEditing(false);
      setNotice('Corrections saved. You can continue reviewing this document.');
      await onSaved();
    } catch (error) { setError(correctionErrorMessage(error)); }
    finally { setBusy(false); }
  };
  const field = (section: 'profile' | 'document', key: string, label: string) => {
    if (!draft) return null;
    const values = draft[section] as unknown as Record<string, string | null>;
    const isDate = ['date_of_birth', 'date_issued', 'valid_until'].includes(key);
    const id = `${documentId}-${section}-${key}`;
    return <label key={key} htmlFor={id} className="block min-w-0 text-xs text-zinc-600">
      {label}
      <input id={id} aria-label={`${section === 'profile' ? 'Account' : 'Document'} ${label.toLowerCase()}`}
        type={isDate ? 'date' : 'text'} value={values[key] ?? ''} disabled={busy} maxLength={isDate ? undefined : 100}
        required={section === 'profile' && ['first_name', 'last_name'].includes(key)}
        onChange={event => setDraft({ ...draft, [section]: { ...draft[section], [key]: event.target.value } })}
        className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:opacity-60" />
    </label>;
  };
  return <section className="my-4 rounded-xl border border-zinc-200 p-3">
    {!editing ? <button type="button" disabled={busy} onClick={() => void open()} className="min-h-10 rounded-full bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-200 disabled:opacity-50 cursor-pointer">
      {busy ? 'Loading details…' : 'Edit details'}
    </button> : <form onSubmit={event => void save(event)} aria-label="Correct identity and document details">
      <p className="mb-3 text-xs text-zinc-600">Correct only details you can confirm from the submitted document. Saving records your edits in the Audit Trail and does not approve the document.</p>
      <fieldset disabled={busy} className="min-w-0">
        <legend className="mb-2 text-sm font-semibold text-zinc-900">Account details</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{IDENTITY_FIELDS.map(([key, label]) => field('profile', key, label))}</div>
        <p className="mt-2 text-xs text-zinc-500">Login, contact information, role and barangay cannot be edited here.</p>
      </fieldset>
      <fieldset disabled={busy} className="mt-4 min-w-0">
        <legend className="mb-2 text-sm font-semibold text-zinc-900">Document details</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {IDENTITY_FIELDS.map(([key, label]) => field('document', key, label))}
          {field('document', 'document_number', 'Document number')}
          {!draft?.document_type.startsWith('national_id') && <>
            {field('document', 'date_issued', 'Issue date')}
            {field('document', 'valid_until', 'Expiry date')}
          </>}
        </div>
      </fieldset>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="submit" disabled={busy} className="min-h-10 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 cursor-pointer">{busy ? 'Saving…' : 'Save corrections'}</button>
        <button type="button" disabled={busy} onClick={() => { setEditing(false); setDraft(null); setError(''); setNotice(''); }} className="min-h-10 rounded-full bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-700 disabled:opacity-50 cursor-pointer">Cancel</button>
      </div>
    </form>}
    {notice && <p role="status" className="mt-2 text-xs text-emerald-800">{notice}</p>}
    {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
  </section>;
};
