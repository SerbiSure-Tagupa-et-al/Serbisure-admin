import React from 'react';
import { ShieldCheck } from 'lucide-react';

export function PurgedMediaCard({ purgedAt }: { purgedAt: string }): React.ReactElement {
  const date = new Date(purgedAt);
  const removedAt = Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString('en-US', {
    timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }) + ' PHT';
  return <section role="status" aria-label="Image removed under retention policy" className="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-5 text-sm">
    <div className="flex items-start gap-3">
      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
      <div className="min-w-0">
        <h4 className="font-bold text-zinc-900">Image Removed Under RA 10173</h4>
        <p className="mt-1 text-xs font-medium text-amber-900">Removed: {removedAt}</p>
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">This original document image was permanently deleted from cloud storage under SerbiSure's RA 10173 retention policy. The verification status, reviewer, issue/expiry dates, and audit trail remain preserved.</p>
      </div>
    </div>
  </section>;
}
