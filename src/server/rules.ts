import type { Decision } from './models.js';

export const REFERENCE_DATE = '2026-09-09';
export const MANDATORY = ['full_name', 'date_of_birth', 'document_number', 'expiry_date'] as const;

export const PATTERNS: Record<string, RegExp> = {
  passport: /^PXT\d{6}$/,
  national_id: /^MID-\d{4}-\d{4}$/,
  driving_licence: /^MDL-\d{6}$/,
};

export function completeness(fields: Record<string, string>): number {
  const present = MANDATORY.filter(k => Boolean(fields[k])).length;
  return Math.round((present / MANDATORY.length) * 1000) / 1000;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

export function evaluate(
  fields: Record<string, string>,
  rawText: string
): {
  decision: Decision;
  reasons: string[];
  warnings: string[];
} {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const dtype = (fields.document_type || '').toLowerCase();
  const c = completeness(fields);

  if (c < 0.75) {
    reasons.push('INSUFFICIENT_MANDATORY_FIELDS');
  }

  const num = fields.document_number || '';
  const pat = PATTERNS[dtype];
  if (pat && num && !pat.test(num)) {
    reasons.push('INVALID_DOCUMENT_NUMBER_FORMAT');
  }

  const expiry = fields.expiry_date;
  if (expiry) {
    if (!isValidIsoDate(expiry)) {
      reasons.push('INVALID_EXPIRY_DATE');
    } else if (expiry < REFERENCE_DATE) {
      reasons.push('DOCUMENT_EXPIRED');
    }
  }

  if (rawText.includes('ALTERED_TEXT_REGION_DETECTED')) {
    reasons.push('SUSPECTED_TAMPERING');
  }

  if (rawText.includes('DEGRADED')) {
    warnings.push('OCR_QUALITY_DEGRADED');
  }

  if (rawText.includes('90_DEGREES')) {
    warnings.push('ROTATED_DOCUMENT');
  }

  if (reasons.some(r => r === 'SUSPECTED_TAMPERING' || r === 'DOCUMENT_EXPIRED')) {
    return { decision: 'REJECT', reasons, warnings };
  }

  if (reasons.length > 0 || warnings.length > 0) {
    return {
      decision: 'REVIEW',
      reasons: reasons.length > 0 ? reasons : ['MANUAL_REVIEW_REQUIRED'],
      warnings,
    };
  }

  return {
    decision: 'APPROVE',
    reasons: ['BASELINE_RULES_PASSED'],
    warnings,
  };
}
