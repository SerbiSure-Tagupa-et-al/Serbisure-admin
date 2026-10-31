import React from 'react';
import { correctionChanges, correctionChangeText } from '../../data/reviewerCorrections';

export const AuditCorrectionDetails: React.FC<{ metadata?: Record<string, unknown> }> = ({ metadata }) => {
  const changes = correctionChanges(metadata);
  if (!changes.length) return null;
  return <ul className="space-y-1 text-[11px] text-zinc-700 break-words">
    {changes.map(change => <li key={`${change.section}-${change.field}`}>{correctionChangeText(change)}</li>)}
  </ul>;
};
