export const PREFIXES: Record<string, string> = {
  'DOCUMENT TYPE:': 'document_type',
  'NAME:': 'full_name',
  'DOB:': 'date_of_birth',
  'DOCUMENT NO:': 'document_number',
  'ISSUE DATE:': 'issue_date',
  'EXPIRY DATE:': 'expiry_date',
  'ADDRESS:': 'address',
  'NATIONALITY:': 'nationality',
};

const IGNORED_LINE_PREFIXES = [
  'OCR_QUALITY:',
  'UNREADABLE_GLYPHS:',
  'CAPTURE_ORIENTATION:',
  'SECURITY NOTE:',
];

export function parseLegacyOcr(text: string): { fields: Record<string, string>; warnings: string[] } {
  const fields: Record<string, string> = {};
  const warnings: string[] = [];

  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    let matched = false;
    for (const [prefix, key] of Object.entries(PREFIXES)) {
      if (line.startsWith(prefix)) {
        fields[key] = line.slice(prefix.length).trim();
        matched = true;
        break;
      }
    }
    if (
      !matched &&
      line.includes(':') &&
      !IGNORED_LINE_PREFIXES.some(p => line.startsWith(p))
    ) {
      warnings.push(`UNPARSED_LINE:${line.slice(0, 40)}`);
    }
  }

  if (text.includes('OCR_QUALITY: DEGRADED')) {
    warnings.push('DEGRADED_OCR_QUALITY');
  }
  if (text.includes('CAPTURE_ORIENTATION: 90_DEGREES')) {
    warnings.push('ROTATED_CAPTURE');
  }

  return { fields, warnings };
}
