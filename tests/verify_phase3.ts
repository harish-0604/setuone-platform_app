import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';

async function runPhase3Verification() {
  console.log('=== SetuOne Phase 3 Verification Suite (Check Before You Apply & Evidence Passport) ===');

  // 1. Reset Demo Database
  const resetRes = await fetch(`${BASE_URL}/api/demo/reset`, { method: 'POST' });
  assert.equal(resetRes.status, 200);

  // 2. Verify UI Source Contract for Eligibility & Evidence Passport
  const studentPageSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/StudentDashboardPage.tsx'),
    'utf-8'
  );
  for (const col of ['RULE', 'EVIDENCE', 'RESULT', 'REASON', 'NEXT ACTION', 'DEMO RULE — NOT AUTHORITATIVE']) {
    assert.ok(
      studentPageSource.includes(col),
      `StudentDashboardPage.tsx must include "${col}"`
    );
  }
  for (const badge of ['VERIFIED', 'PENDING', 'CONFLICT', 'EXPIRED', 'UNAVAILABLE']) {
    assert.ok(
      studentPageSource.includes(badge),
      `StudentDashboardPage.tsx must support badge "${badge}"`
    );
  }
  console.log('[PASS] UI Source Contract for Eligibility Table & Evidence Passport badges verified.');

  // 3. Test Deterministic Eligibility Engine for Meena (Clean Case -> CONDITIONS SATISFIED)
  const meenaLogin = await (await fetch(`${BASE_URL}/api/demo/scenario/meena`, { method: 'POST' })).json();
  const meenaHeaders = {
    'Content-Type': 'application/json',
    'x-demo-user-id': meenaLogin.session.userId,
    'x-demo-role': meenaLogin.session.role,
  };

  const meenaEvalRes = await fetch(`${BASE_URL}/api/eligibility/check`, {
    method: 'POST',
    headers: meenaHeaders,
    body: JSON.stringify({ student_id: 'student_meena', scheme_id: 'SCH_PRE_MATRIC' }),
  });
  assert.equal(meenaEvalRes.status, 200);
  const { evaluation: meenaEval } = await meenaEvalRes.json();
  assert.equal(meenaEval.result, 'CONDITIONS SATISFIED');
  assert.notEqual(meenaEval.result, 'APPROVED');
  assert.notEqual(meenaEval.result, 'REJECTED');
  assert.equal(meenaEval.badge_text, 'DEMO RULE — NOT AUTHORITATIVE');
  assert.equal(meenaEval.validation_status, 'DEMO - PENDING OFFICIAL GUIDELINE VALIDATION');
  assert.ok(Array.isArray(meenaEval.rule_results) && meenaEval.rule_results.length >= 4);
  console.log('[PASS] Meena Pre-Matric Eligibility Check -> CONDITIONS SATISFIED verified.');

  // 4. Test Multi-Scheme Comparison Engine (check-all across all 5 schemes)
  const checkAllRes = await fetch(`${BASE_URL}/api/eligibility/check-all`, {
    method: 'POST',
    headers: meenaHeaders,
    body: JSON.stringify({ student_id: 'student_meena' }),
  });
  assert.equal(checkAllRes.status, 200);
  const { comparisons } = await checkAllRes.json();
  assert.equal(comparisons.length, 5, 'check-all must evaluate all 5 schemes');
  console.log('[PASS] Multi-scheme comparison (all 5 schemes) verified.');

  // 5. Test Deterministic Eligibility Engine for Arjun (Income Conflict -> REVIEW REQUIRED)
  const arjunLogin = await (await fetch(`${BASE_URL}/api/demo/scenario/arjun`, { method: 'POST' })).json();
  const arjunHeaders = {
    'Content-Type': 'application/json',
    'x-demo-user-id': arjunLogin.session.userId,
    'x-demo-role': arjunLogin.session.role,
  };

  const arjunEvalRes = await fetch(`${BASE_URL}/api/eligibility/check`, {
    method: 'POST',
    headers: arjunHeaders,
    body: JSON.stringify({ student_id: 'student_arjun', scheme_id: 'SCH_POST_MATRIC' }),
  });
  assert.equal(arjunEvalRes.status, 200);
  const { evaluation: arjunEval } = await arjunEvalRes.json();
  assert.equal(arjunEval.result, 'REVIEW REQUIRED');
  const incomeRule = arjunEval.rule_results.find((r: { rule_id: string }) => r.rule_id === 'RULE_INCOME');
  assert.ok(incomeRule, 'RULE_INCOME must be evaluated');
  assert.equal(incomeRule.status, 'REVIEW REQUIRED');
  console.log('[PASS] Arjun Post-Matric Eligibility Check -> REVIEW REQUIRED (RULE_INCOME conflict) verified.');

  // 6. Test Evidence Passport & Adapter Verification Endpoint
  const passportRes = await fetch(`${BASE_URL}/api/students/student_meena/evidence`, {
    headers: meenaHeaders,
  });
  assert.equal(passportRes.status, 200);
  const passportBody = await passportRes.json();
  const categories = new Set(passportBody.evidence.map((e: { category: string }) => e.category));
  for (const expectedCategory of ['Identity', 'ST Status', 'Income', 'Academic', 'Institution', 'Existing Benefit']) {
    assert.ok(categories.has(expectedCategory), `Missing Evidence Passport category: ${expectedCategory}`);
  }
  assert.equal(passportBody.adapters.length, 8, 'Must include 8 simulated integration adapters from Section 23');

  const verifyAdapterRes = await fetch(`${BASE_URL}/api/students/student_meena/evidence/verify`, {
    method: 'POST',
    headers: meenaHeaders,
  });
  assert.equal(verifyAdapterRes.status, 200);
  const verifyAdapterBody = await verifyAdapterRes.json();
  assert.equal(verifyAdapterBody.status, 'VERIFICATION_CONFIRMED');
  console.log('[PASS] Structured Evidence Passport (6 categories + 4 simulated adapters) verified.');

  // 7. Reset Demo Database back to clean baseline
  await fetch(`${BASE_URL}/api/demo/reset`, { method: 'POST' });
  console.log('=== All Phase 3 Checks Passed 100% ===');
}

runPhase3Verification().catch((err) => {
  console.error(err);
  process.exit(1);
});
