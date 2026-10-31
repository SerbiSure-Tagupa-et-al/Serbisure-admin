import React, { useState } from 'react';
import { previewExpiredClearances, processExpiredClearances } from '../../api/adminApi';

export const ProcessExpirationsButton: React.FC<{ onProcessed: () => Promise<void> }> = ({ onProcessed }) => {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const process = async () => {
    if (busy) return;
    setBusy(true); setNotice(''); setError('');
    try {
      const preview = await previewExpiredClearances();
      if (!preview.document_count) {
        setNotice('No expired clearances need processing in your jurisdiction.');
        return;
      }
      const confirmed = window.confirm(
        `Mark ${preview.document_count} expired clearance${preview.document_count === 1 ? '' : 's'} ` +
        `from ${preview.worker_count} worker${preview.worker_count === 1 ? '' : 's'} as Rejected?\n\n` +
        `Jurisdiction: ${preview.scope}. This action covers the whole jurisdiction, regardless of the table filters.\n\n` +
        'Expiry is based on the saved dates. Valid clearances stay unchanged. Affected workers will receive a renewal notification.',
      );
      if (!confirmed) return;
      const result = await processExpiredClearances(preview.confirmation_token);
      setNotice(`${result.document_count} expired clearance${result.document_count === 1 ? '' : 's'} processed. Workers can now upload renewals.`);
      await onProcessed();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not process expirations. Preview and try again.');
    } finally { setBusy(false); }
  };
  return <div className="mb-4 rounded-xl border border-orange-100 bg-orange-50/50 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-zinc-600">Request renewals for expired worker clearances in your jurisdiction.</p>
      <button type="button" disabled={busy} onClick={() => void process()} className="min-h-10 rounded-full bg-orange-100 px-4 py-2 text-xs font-semibold text-orange-900 hover:bg-orange-200 disabled:opacity-50 cursor-pointer">
        {busy ? 'Checking expirations…' : 'Process expired clearances'}
      </button>
    </div>
    {notice && <p role="status" className="mt-2 text-xs text-zinc-700">{notice}</p>}
    {error && <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p>}
  </div>;
};
