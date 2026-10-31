import type { ReviewerCorrectionDetails, ReviewerCorrectionPatch } from '../api/adminApi';

export function buildCorrectionPatch(original: ReviewerCorrectionDetails, draft: ReviewerCorrectionDetails): ReviewerCorrectionPatch | null {
  const patch: ReviewerCorrectionPatch = { version: original.version };
  let changed = false;
  for (const section of ['profile', 'document'] as const) {
    const fields: Record<string, string | null> = {};
    for (const key of Object.keys(original[section])) {
      const name = key as keyof typeof original[typeof section];
      const value = draft[section][name]?.trim() || null;
      const previous = original[section][name]?.trim() || null;
      if (value !== previous) { fields[key] = value; changed = true; }
    }
    if (Object.keys(fields).length) patch[section] = fields;
  }
  return changed ? patch : null;
}

const FIELD_LABELS: Record<string, string> = {
  first_name: 'First name', middle_name: 'Middle name', last_name: 'Last name',
  date_of_birth: 'Birthdate', document_number: 'Document number',
  date_issued: 'Issue date', valid_until: 'Expiry date',
};

export interface CorrectionChange {
  section: 'profile' | 'document';
  field: string;
  old: string | null;
  new: string | null;
}

export function correctionChanges(metadata?: Record<string, unknown>): CorrectionChange[] {
  if (metadata?.reason_code !== 'reviewer_correction' || !Array.isArray(metadata.changes)) return [];
  return metadata.changes.filter((change): change is CorrectionChange =>
    change && ['profile', 'document'].includes(change.section) && FIELD_LABELS[change.field] &&
    (change.old === null || typeof change.old === 'string') && (change.new === null || typeof change.new === 'string'));
}

export function correctionChangeText(change: CorrectionChange): string {
  const section = change.section === 'profile' ? 'Account' : 'Document';
  return `${section} · ${FIELD_LABELS[change.field]}: ${change.old || 'Not set'} → ${change.new || 'Not set'}`;
}

export function correctionSummary(metadata?: Record<string, unknown>): string {
  return correctionChanges(metadata).map(correctionChangeText).join('; ');
}

export function correctionErrorMessage(error: unknown): string {
  const data = (error as { data?: unknown })?.data;
  const messages = (value: unknown): string[] => typeof value === 'string' ? [value]
    : value && typeof value === 'object' ? Object.values(value).flatMap(messages) : [];
  const detail = [...new Set(messages(data))].join(' ');
  return detail || (error instanceof Error ? error.message : 'Could not save. Please try again.');
}
