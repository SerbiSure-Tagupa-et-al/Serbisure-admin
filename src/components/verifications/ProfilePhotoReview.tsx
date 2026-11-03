import React from 'react';
import type { VerificationRequest } from '../../types/admin';

export function ProfilePhotoReview({ photo, documents, onSelect, onApprove, onReject }: {
  photo: VerificationRequest;
  documents: VerificationRequest[];
  onSelect: (id: string) => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string, reason: string) => Promise<void>;
}) {
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [confirmReject, setConfirmReject] = React.useState(false);
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const review = async (reject: boolean) => {
    if (busy || !imageLoaded) return;
    if (reject && !reason.trim()) { setMessage('Please explain what needs to be fixed in the photo.'); return; }
    setBusy(true); setMessage('');
    try {
      if (reject) await onReject(photo.id, reason.trim());
      else await onApprove(photo.id);
      setMessage(reject ? 'Photo rejected. The user can now retake it.' : 'Profile photo approved.');
      setReason(''); setConfirmReject(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The review could not be saved. Please try again.'); }
    finally { setBusy(false); }
  };
  const status = photo.status === 'VERIFIED' ? 'Verified' : photo.status === 'REJECTED' ? 'Rejected' : 'Pending';
  return <section className="min-w-0 rounded-3xl bg-white p-5 sm:p-6 space-y-5" aria-label="Profile Photo Review">
    <div><h3 className="text-xl font-bold">Profile Photo</h3><p className="text-sm text-zinc-600">{photo.name} · {photo.barangay}</p></div>
    <nav className="flex flex-wrap gap-2" aria-label="Applicant documents">
      {documents.map(doc => <button key={doc.id} disabled={busy} type="button" onClick={() => onSelect(doc.id)}
        aria-current={doc.id === photo.id ? 'true' : undefined} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{doc.documentType}</button>)}
    </nav>
    {photo.documentImage ? <img src={photo.documentImage} alt={`${photo.name}'s profile photo`}
      onLoad={() => setImageLoaded(true)} onError={() => { setImageLoaded(false); setMessage('Photo could not load. Refresh the queue before reviewing.'); }}
      className="mx-auto max-h-80 w-full rounded-xl object-contain bg-zinc-50" />
      : <p role="alert">Photo unavailable. Refresh the queue before reviewing.</p>}
    <p className="text-sm font-semibold">Photo status: {status}</p>
    {photo.notes && <p className="rounded-lg bg-amber-50 p-3 text-sm">Reviewer feedback: {photo.notes}</p>}
    <p className="text-sm text-zinc-600">Check that the face is clear and matches the person's ID. Approving this photo does not approve their other documents.</p>
    <label className="block text-sm font-medium" htmlFor="photo-rejection-reason">Reason if rejected (required)</label>
    <textarea id="photo-rejection-reason" value={reason} onChange={event => { setReason(event.target.value); setConfirmReject(false); }}
      disabled={busy} maxLength={1000} rows={3} placeholder="For example: The photo is too dark. Please take it in a brighter place."
      className="w-full rounded-xl border border-zinc-200 p-3 text-sm" />
    {message && <p role="status" className="text-sm">{message}</p>}
    {confirmReject && <div className="rounded-xl bg-rose-50 p-3 text-sm space-y-3">
      <p>Reject this photo? The user will need to take a new photo before booking or applying.</p>
      <button type="button" disabled={busy} onClick={() => void review(true)} className="rounded-lg bg-rose-700 text-white px-4 py-3 disabled:opacity-50">Confirm rejection</button>
      <button type="button" disabled={busy} onClick={() => setConfirmReject(false)} className="ml-3 px-3 py-3">Keep reviewing</button>
    </div>}
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={busy || !imageLoaded} onClick={() => void review(false)} className="rounded-xl bg-emerald-700 text-white px-4 py-3 disabled:opacity-50">{busy ? 'Saving...' : 'Approve Photo'}</button>
      <button type="button" disabled={busy || !imageLoaded} onClick={() => {
        if (!reason.trim()) setMessage('Please explain what needs to be fixed in the photo.');
        else setConfirmReject(true);
      }} className="rounded-xl border border-rose-300 text-rose-800 px-4 py-3 disabled:opacity-50">Reject Photo</button>
    </div>
  </section>;
}
