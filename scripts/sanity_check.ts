import assert from 'node:assert';
import { listCases, loadApplication, loadGroundTruth, loadSidecar, loadExpectedBaselineOutput, safeId } from '../src/server/repository.js';
import { verifyDocument, verifyCase } from '../src/server/service.js';

console.log('--- Running Brownfield KYC Sanity Check ---');

// Test safeId validation
assert.throws(() => safeId('../secret'), /invalid identifier/);
assert.throws(() => safeId('case/001'), /invalid identifier/);
assert.throws(() => safeId(''), /invalid identifier/);
assert.strictEqual(safeId('CASE-001'), 'CASE-001');
console.log('✓ safeId validation blocks path traversal');

// Test cases
const cases = listCases();
assert.strictEqual(cases.length, 6, 'Expected 6 cases');
console.log('✓ Exactly 6 applicant cases present');

// Test each case against ground truth and expected baseline outputs
for (const c of cases) {
  const result = verifyCase(c.case_id);
  const expected = loadExpectedBaselineOutput(c.case_id);
  assert(expected, `Expected baseline output for ${c.case_id} must exist`);
  assert.strictEqual(result.decision, expected.decision, `Decision mismatch for ${c.case_id}`);
  assert.deepStrictEqual(result.reason_codes, expected.reason_codes, `Reason codes mismatch for ${c.case_id}`);
  assert.strictEqual(result.documents.length, expected.documents.length, `Document count mismatch for ${c.case_id}`);

  for (let i = 0; i < result.documents.length; i++) {
    const docActual = result.documents[i];
    const docExpected = expected.documents[i];
    assert.strictEqual(docActual.document_id, docExpected.document_id);
    assert.strictEqual(docActual.decision, docExpected.decision);
    assert.deepStrictEqual(docActual.reason_codes, docExpected.reason_codes);
    assert.deepStrictEqual(docActual.warnings, docExpected.warnings);
    assert.strictEqual(docActual.completeness, docExpected.completeness);
    assert.deepStrictEqual(docActual.parsed_fields, docExpected.parsed_fields);
  }
  console.log(`✓ Case ${c.case_id} evaluated with outcome: ${result.decision}`);
}

// Test individual document verification
const docResult = verifyDocument('CASE-001-PASSPORT');
assert.strictEqual(docResult.decision, 'APPROVE');
assert.strictEqual(docResult.completeness, 1.0);

console.log('--- SANITY CHECK PASSED: All 6 cases and 13 synthetic documents verified ---');
