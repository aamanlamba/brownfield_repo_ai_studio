export type Decision = 'APPROVE' | 'REVIEW' | 'REJECT';

export interface VerifyDocumentRequest {
  document_id: string;
}

export interface DocumentResult {
  document_id: string;
  document_type: string | null;
  decision: Decision;
  reason_codes: string[];
  parsed_fields: Record<string, string>;
  completeness: number;
  warnings: string[];
  source: string;
}

export interface CaseResult {
  case_id: string;
  decision: Decision;
  reason_codes: string[];
  documents: DocumentResult[];
  limitation_notice: string;
}

export interface ApplicationCase {
  case_id: string;
  submitted_name: string;
  submitted_dob: string;
  submitted_address: string;
  document_ids: string[];
  scenario: string;
}

export interface GroundTruthDocument {
  document_id: string;
  case_id: string;
  document_type: string;
  full_name: string;
  date_of_birth: string;
  document_number: string;
  issue_date: string;
  expiry_date: string;
  address?: string;
  nationality?: string;
  scenario_flags: string[];
}
