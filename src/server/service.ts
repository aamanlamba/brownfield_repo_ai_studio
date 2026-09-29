import { loadApplication, loadSidecar } from './repository.js';
import { parseLegacyOcr } from './parser.js';
import { evaluate, completeness } from './rules.js';
import type { Decision, DocumentResult, CaseResult } from './models.js';

const RANK: Record<Decision, number> = {
  APPROVE: 0,
  REVIEW: 1,
  REJECT: 2,
};

export function verifyDocument(documentId: string): DocumentResult {
  const text = loadSidecar(documentId);
  const { fields, warnings: parseWarnings } = parseLegacyOcr(text);
  const { decision, reasons, warnings: ruleWarnings } = evaluate(fields, text);

  return {
    document_id: documentId,
    document_type: fields.document_type || null,
    decision,
    reason_codes: reasons,
    parsed_fields: fields,
    completeness: completeness(fields),
    warnings: [...parseWarnings, ...ruleWarnings],
    source: 'deterministic_sidecar_ocr',
  };
}

export function verifyCase(caseId: string): CaseResult {
  const app = loadApplication(caseId);
  const docs = app.document_ids.map(id => verifyDocument(id));

  let worst: Decision = 'APPROVE';
  for (const doc of docs) {
    if (RANK[doc.decision] > RANK[worst]) {
      worst = doc.decision;
    }
  }

  const reasonSet = new Set<string>();
  for (const doc of docs) {
    for (const r of doc.reason_codes) {
      reasonSet.add(r);
    }
  }
  const reasonCodes = Array.from(reasonSet).sort();

  return {
    case_id: caseId,
    decision: worst,
    reason_codes: reasonCodes,
    documents: docs,
    limitation_notice:
      'Repo 1.0 aggregates document decisions only; it does not perform robust cross-document identity resolution.',
  };
}
