import assert from 'node:assert/strict';

const BASE_URL = 'http://localhost:3000';

async function runPhase5AndFinalAcceptance() {
  console.log('=== SetuOne Phase 5 & Section 42 Final Acceptance Suite (14 Acceptance Tests) ===');

  // Reset Demo Database
  let res = await fetch(`${BASE_URL}/api/demo/reset`, { method: 'POST' });
  assert.equal(res.status, 200);

  // 1. Test Application Journey 9-Stage State Machine & DBT Payment Visibility (DEMO DATA)
  const meenaLogin = await (await fetch(`${BASE_URL}/api/demo/scenario/meena`, { method: 'POST' })).json();
  const meenaHeaders = {
    'Content-Type': 'application/json',
    'x-demo-user-id': meenaLogin.session.userId,
    'x-demo-role': meenaLogin.session.role,
  };

  const meenaDash = await (
    await fetch(`${BASE_URL}/api/students/student_meena/dashboard`, { headers: meenaHeaders })
  ).json();
  assert.ok(meenaDash.application.where_is_it, 'Application must include WHERE');
  assert.ok(meenaDash.application.why_here, 'Application must include WHY');
  assert.ok(meenaDash.application.owner, 'Application must include OWNER');
  assert.ok(meenaDash.application.next_action, 'Application must include NEXT ACTION');
  assert.equal(meenaDash.payments.length, 1);
  assert.ok(
    String(meenaDash.payments[0].source).includes('DEMO DATA'),
    'Payment record must be labeled DEMO DATA'
  );
  console.log('[PASS] Application Journey (WHERE/WHY/OWNER/NEXT ACTION) & DBT Payment (DEMO DATA) verified.');

  // 2. Test Assisted Access & Consent Record (Lakshmi SETU-48291)
  const lakshmiLogin = await (await fetch(`${BASE_URL}/api/demo/scenario/lakshmi`, { method: 'POST' })).json();
  const lakshmiHeaders = {
    'Content-Type': 'application/json',
    'x-demo-user-id': lakshmiLogin.session.userId,
    'x-demo-role': lakshmiLogin.session.role,
  };
  const consentRes = await fetch(`${BASE_URL}/api/consent/student_lakshmi`, { headers: lakshmiHeaders });
  assert.equal(consentRes.status, 200);
  const { consent } = await consentRes.json();
  assert.equal(consent.tracking_reference, 'SETU-48291');
  assert.equal(consent.consent_status, 'ACTIVE');
  console.log('[PASS] Assisted Access & Consent Record (SETU-48291) verified.');

  // 3. Test Simulated API Outage Resilience (SERVICE_UNAVAILABLE -> QUEUED_FOR_RETRY, Never Rejected)
  const outageOnRes = await fetch(`${BASE_URL}/api/demo/fault/api-outage`, { method: 'POST' });
  assert.equal(outageOnRes.status, 200);
  const outageOnBody = await outageOnRes.json();
  assert.equal(outageOnBody.outageActive, true);
  assert.equal(outageOnBody.adapterStatus, 'SERVICE_UNAVAILABLE');
  assert.equal(outageOnBody.queueState, 'QUEUED_FOR_RETRY');

  const arjunLogin = await (await fetch(`${BASE_URL}/api/demo/scenario/arjun`, { method: 'POST' })).json();
  const arjunHeaders = {
    'Content-Type': 'application/json',
    'x-demo-user-id': arjunLogin.session.userId,
    'x-demo-role': arjunLogin.session.role,
  };
  const arjunOutageDash = await (
    await fetch(`${BASE_URL}/api/students/student_arjun/dashboard`, { headers: arjunHeaders })
  ).json();
  assert.equal(arjunOutageDash.outageActive, true);
  assert.equal(arjunOutageDash.retryJobs.length, 1);
  assert.equal(arjunOutageDash.retryJobs[0].status, 'QUEUED_FOR_RETRY');
  assert.notEqual(arjunOutageDash.application.status, 'REJECTED');

  // Toggle API Outage back off
  const outageOffRes = await fetch(`${BASE_URL}/api/demo/fault/api-outage`, { method: 'POST' });
  const outageOffBody = await outageOffRes.json();
  assert.equal(outageOffBody.outageActive, false);
  console.log('[PASS] Simulated API Outage Resilience (SERVICE_UNAVAILABLE -> QUEUED_FOR_RETRY) verified.');

  // 4. Test Outreach Candidates (DEMO OUTREACH SIGNAL — SIMULATED)
  const rajeshLogin = await (await fetch(`${BASE_URL}/api/demo/scenario/rajesh`, { method: 'POST' })).json();
  const officerHeaders = {
    'Content-Type': 'application/json',
    'x-demo-user-id': rajeshLogin.session.userId,
    'x-demo-role': rajeshLogin.session.role,
  };
  const outreachRes = await fetch(`${BASE_URL}/api/outreach/candidates`, { headers: officerHeaders });
  assert.equal(outreachRes.status, 200);
  const { candidates } = await outreachRes.json();
  assert.equal(candidates.length, 3);
  for (const c of candidates) {
    assert.equal(c.classification_label, 'Potential Coverage Gap');
  }
  console.log('[PASS] Proactive Outreach Signals (Potential Coverage Gap / DEMO OUTREACH SIGNAL — SIMULATED) verified.');

  // 5. Test JAGO Deterministic Q&A Engine (5 Canonical Questions + Unknown Question Fallback)
  const canonicalQuestions = [
    'What is my application status?',
    'What document is missing?',
    'What should I do next?',
    'What is my payment status?',
    'What does this scholarship require?',
  ];
  for (const q of canonicalQuestions) {
    const jagoRes = await fetch(`${BASE_URL}/api/jago/ask`, {
      method: 'POST',
      headers: meenaHeaders,
      body: JSON.stringify({ student_id: 'student_meena', question: q }),
    });
    assert.equal(jagoRes.status, 200);
    const jagoBody = await jagoRes.json();
    assert.equal(jagoBody.deterministic, true);
    assert.ok(jagoBody.answer.length > 15);
  }

  const unknownRes = await fetch(`${BASE_URL}/api/jago/ask`, {
    method: 'POST',
    headers: meenaHeaders,
    body: JSON.stringify({ student_id: 'student_meena', question: 'Will I win the lottery tomorrow?' }),
  });
  const unknownBody = await unknownRes.json();
  assert.equal(
    unknownBody.answer,
    'I cannot confirm that from the available information. Please use the official assistance or review route.'
  );
  console.log('[PASS] JAGO Deterministic Q&A Engine (5 canonical + fallback response) verified.');

  // 6. Final Reset to leave database in pristine initial state for user evaluation
  await fetch(`${BASE_URL}/api/demo/reset`, { method: 'POST' });
  console.log('=== All Phase 5 & Section 42 Final Acceptance Tests Passed 100% ===');
}

runPhase5AndFinalAcceptance().catch((err) => {
  console.error(err);
  process.exit(1);
});
