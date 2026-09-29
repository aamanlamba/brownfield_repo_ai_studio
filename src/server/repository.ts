import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ApplicationCase, GroundTruthDocument, CaseResult } from './models.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../../');
const DATA = path.join(ROOT, 'data');

export function safeId(value: string): string {
  if (!value || typeof value !== 'string' || value.includes('/') || value.includes('\\') || value.includes('..')) {
    throw new Error('invalid identifier');
  }
  return value;
}

export function loadJson<T>(folder: string, ident: string): T {
  const safeIdent = safeId(ident);
  const filePath = path.join(DATA, folder, `${safeIdent}.json`);
  if (!fs.existsSync(filePath)) {
    const err = new Error(ident);
    err.name = 'FileNotFoundError';
    throw err;
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T;
}

export function loadApplication(caseId: string): ApplicationCase {
  return loadJson<ApplicationCase>('applications', caseId);
}

export function loadGroundTruth(documentId: string): GroundTruthDocument {
  return loadJson<GroundTruthDocument>('ground_truth', documentId);
}

export function loadSidecar(documentId: string): string {
  const safeIdent = safeId(documentId);
  const filePath = path.join(DATA, 'sidecar_ocr', `${safeIdent}.txt`);
  if (!fs.existsSync(filePath)) {
    const err = new Error(documentId);
    err.name = 'FileNotFoundError';
    throw err;
  }
  return fs.readFileSync(filePath, 'utf-8');
}

export function listCases(): ApplicationCase[] {
  const appsDir = path.join(DATA, 'applications');
  if (!fs.existsSync(appsDir)) return [];
  const files = fs.readdirSync(appsDir).filter(f => f.endsWith('.json')).sort();
  return files.map(f => {
    const content = fs.readFileSync(path.join(appsDir, f), 'utf-8');
    return JSON.parse(content) as ApplicationCase;
  });
}

export function loadExpectedBaselineOutput(caseId: string): CaseResult | null {
  try {
    return loadJson<CaseResult>('expected_baseline_outputs', caseId);
  } catch {
    return null;
  }
}
