import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';

async function runPhase4Verification() {
  console.log('=== SetuOne Phase 4 Verification Suite (Conflict Detection & Officer Resolution Engine) ===');

  // 1. Reset Demo Database
  const resetRes = await fetch(`${BASE_URL}/api/demo/reset`, { method: 'POST' });
  assert.equal(resetRes.status, 200);

  // 2. Verify UI Source Contract for Officer Dashboard
  const officerSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/pages/OfficerDashboardPage.tsx'),
    'utf-8'
  );
  for (const requiredText of [
    'Total Cases',
    'Open Exceptions',
    'Resolved Cases',
    'Straight-Through Cases',
    'Student',
    'Exception Type',
    'Status',
    'Owner',
    'Age',
    'Action',
    'Evidence A',
    'Evidence B',
    'Affected Rule',
    'Audit Timeline',
  ]) {
    assert.ok(
      officerSource.includes(requiredText),
      `OfficerDashboardPage.tsx must include "${requiredText}"`
    );
  }
  console.log('[PASS] OfficerDashboardPage UI contract verified.');

  // 3. Authenticate as Officer Rajesh Kumar & inspect Exception Command Centre
  const rajeshLogin = await (await fetch(`${BASE_URL}/api/demo/scenario/rajesh`, { method: 'POST' })).json();
  assert.equal(rajeshLogin.session.fullName, 'Sample 5');
  const officerHeaders = {
    'Content-Type': 'application/json',
    'x-demo-user-id': rajeshLogin.session.userId,
    'x-demo-role': rajeshLogin.session.role,
  };

  const excListRes = await fetch(`${BASE_URL}/api/exceptions`, { headers: officerHeaders });
  assert.equal(excListRes.status, 200);
  const excListBody = await excListRes.json();
  assert.equal(excListBody.metrics.totalCases, 3);
  assert.equal(excListBody.metrics.openExceptions, 1);
  assert.equal(excListBody.metrics.resolvedCases, 0);
  assert.equal(excListBody.metrics.straightThroughCases, 2);

  const arjunExc = excListBody.exceptions[0];
  assert.equal(arjunExc.id, 'exc_arjun_income');
  assert.equal(arjunExc.type, 'INCOME_CONFLICT');
  assert.equal(arjunExc.affected_rule, 'RULE_INCOME');
  assert.equal(Number(arjunExc.evidence_a.claim_value), 240000);
  assert.equal(Number(arjunExc.evidence_b.claim_value), 280000);
  assert.equal(arjunExc.audit_timeline.length, 2, 'Initial audit timeline must have 2 events (10:15, 10:16)');
  console.log('[PASS] Officer Exception Queue & Arjun INCOME_CONFLICT baseline verified.');

  // 4. Test Path A: Officer resolves conflict with corrected income ₹2,40,000 -> Automatic Re-evaluation -> CONDITIONS SATISFIED
  const resolve240Res = await fetch(`${BASE_URL}/api/exceptions/exc_arjun_income/resolve`, {
    method: 'POST',
    headers: officerHeaders,
    body: JSON.stringify({
      accepted_value: 240000,
      accepted_source: 'Verified Corrected Income Certificate (₹2,40,000)',
    }),
  });
  assert.equal(resolve240Res.status, 200);
  const resolve240Body = await resolve240Res.json();
  assert.equal(resolve240Body.status, 'RESOLVED');
  assert.equal(resolve240Body.evaluation.result, 'CONDITIONS SATISFIED');

  // Verify metrics and audit timeline updated in SQLite
  const afterResolveRes = await fetch(`${BASE_URL}/api/exceptions`, { headers: officerHeaders });
  const afterResolveBody = await afterResolveRes.json();
  assert.equal(afterResolveBody.metrics.openExceptions, 0);
  assert.equal(afterResolveBody.metrics.resolvedCases, 1);
  assert.equal(
    afterResolveBody.exceptions[0].audit_timeline.length,
    5,
    'Audit timeline must have 5 events after resolution and automatic re-evaluation'
  );
  console.log('[PASS] Officer Resolution Path A (₹2,40,000 -> CONDITIONS SATISFIED + 5 Audit Events) verified.');

  // 5. Reset & Test Path B: Officer confirms certificate income ₹2,80,000 -> Automatic Re-evaluation -> CONDITION NOT SATISFIED
  await fetch(`${BASE_URL}/api/demo/reset`, { method: 'POST' });
  const resolve280Res = await fetch(`${BASE_URL}/api/exceptions/exc_arjun_income/resolve`, {
    method: 'POST',
    headers: officerHeaders,
    body: JSON.stringify({
      accepted_value: 280000,
      accepted_source: 'State e-District Income Certificate Confirmed (₹2,80,000)',
    }),
  });
  assert.equal(resolve280Res.status, 200);
  const resolve280Body = await resolve280Res.json();
  assert.equal(resolve280Body.status, 'RESOLVED');
  assert.equal(
    resolve280Body.evaluation.result,
    'CONDITION NOT SATISFIED',
    'Confirmed ₹2,80,000 exceeds ₹2,50,000 threshold and must genuinely evaluate to CONDITION NOT SATISFIED'
  );
  console.log('[PASS] Officer Resolution Path B (₹2,80,000 -> CONDITION NOT SATISFIED) verified.');

  // 6. Restore clean baseline
  await fetch(`${BASE_URL}/api/demo/reset`, { method: 'POST' });
  console.log('=== All Phase 4 Checks Passed 100% ===');
}

runPhase4Verification().catch((err) => {
  console.error(err);
  process.exit(1);
});
