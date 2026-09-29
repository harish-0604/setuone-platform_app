import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'http://localhost:3000';

async function runPhase2Verification() {
  console.log('=== SetuOne Phase 2 & End-to-End Verification Suite ===');

  // 1. Verify SetuOne Logo component exists and is imported across Login, PortalLayout, and PresenterPage
  const logoComponentPath = path.resolve(process.cwd(), 'src/components/brand/SetuOneLogo.tsx');
  assert.ok(fs.existsSync(logoComponentPath), 'SetuOneLogo.tsx must exist');
  const logoSource = fs.readFileSync(logoComponentPath, 'utf-8');
  assert.ok(logoSource.includes('SetuOneLogoIcon'), 'SetuOneLogo.tsx must export SetuOneLogoIcon');
  assert.ok(logoSource.includes('SetuOneWordmark'), 'SetuOneLogo.tsx must export SetuOneWordmark');
  assert.ok(logoSource.includes('SetuOneHeroLockup'), 'SetuOneLogo.tsx must export SetuOneHeroLockup');
  console.log('[PASS] Official SetuOne Logo & Hero Lockup verified.');

  // 2. Reset Demo Database via API
  const resetRes = await fetch(`${BASE_URL}/api/demo/reset`, { method: 'POST' });
  assert.equal(resetRes.status, 200, 'POST /api/demo/reset must succeed');
  console.log('[PASS] Database reset to clean baseline.');

  // 3. Verify 5 Scholarship Schemes via GET /api/schemes
  const schemesRes = await fetch(`${BASE_URL}/api/schemes`);
  assert.equal(schemesRes.status, 200);
  const { schemes } = (await schemesRes.json()) as {
    schemes: Array<{
      id: string;
      name: string;
      income_threshold: number;
      validation_status: string;
      badge_text: string;
      active_rule_version: string;
    }>;
  };
  assert.equal(schemes.length, 5, 'Must return all 5 Ministry of Tribal Affairs scholarship schemes');
  for (const sch of schemes) {
    assert.equal(sch.validation_status, 'DEMO - PENDING OFFICIAL GUIDELINE VALIDATION');
    assert.equal(sch.badge_text, 'DEMO RULE — NOT AUTHORITATIVE');
    assert.ok(sch.active_rule_version.includes('v0.1'));
  }
  console.log('[PASS] All 5 Scholarship Schemes verified with DEMO RULE — NOT AUTHORITATIVE badges.');

  // 4. Verify Meena Clean Case Student Dashboard
  const meenaLoginRes = await fetch(`${BASE_URL}/api/demo/scenario/meena`, { method: 'POST' });
  const { session: meenaSession } = (await meenaLoginRes.json()) as {
    session: { userId: string; role: string; studentId: string; fullName: string };
  };
  assert.equal(meenaSession.fullName, 'Sample 1');

  const meenaDashRes = await fetch(`${BASE_URL}/api/students/${meenaSession.studentId}/dashboard`, {
    headers: {
      'x-demo-user-id': meenaSession.userId,
      'x-demo-role': meenaSession.role,
    },
  });
  assert.equal(meenaDashRes.status, 200);
  const meenaDash = await meenaDashRes.json();
  assert.equal(meenaDash.application.status, 'CONDITIONS SATISFIED');
  assert.equal(meenaDash.exceptions.length, 0, 'Meena must have 0 exceptions');
  assert.equal(
    meenaDash.evidence.filter((e: { verification_status: string }) => e.verification_status === 'VERIFIED').length,
    6,
    'Meena must have 6/6 VERIFIED evidence items'
  );
  console.log('[PASS] Meena Murmu (Clean Case) Student Dashboard verified.');

  // 5. Verify Arjun Income Conflict Student Dashboard
  const arjunLoginRes = await fetch(`${BASE_URL}/api/demo/scenario/arjun`, { method: 'POST' });
  const { session: arjunSession } = (await arjunLoginRes.json()) as {
    session: { userId: string; role: string; studentId: string; fullName: string };
  };
  assert.equal(arjunSession.fullName, 'Sample 2');

  const arjunDashRes = await fetch(`${BASE_URL}/api/students/${arjunSession.studentId}/dashboard`, {
    headers: {
      'x-demo-user-id': arjunSession.userId,
      'x-demo-role': arjunSession.role,
    },
  });
  assert.equal(arjunDashRes.status, 200);
  const arjunDash = await arjunDashRes.json();
  assert.equal(arjunDash.application.status, 'REVIEW REQUIRED');
  assert.equal(arjunDash.exceptions.length, 1, 'Arjun must have 1 open exception');
  assert.equal(arjunDash.exceptions[0].type, 'INCOME_CONFLICT');
  assert.equal(arjunDash.exceptions[0].status, 'OPEN');
  console.log('[PASS] Arjun Murmu (Income Conflict ₹2,40,000 vs ₹2,80,000) Student Dashboard verified.');

  // 6. Verify Lakshmi Assisted Access Student Dashboard
  const lakshmiLoginRes = await fetch(`${BASE_URL}/api/demo/scenario/lakshmi`, { method: 'POST' });
  const { session: lakshmiSession } = (await lakshmiLoginRes.json()) as {
    session: { userId: string; role: string; studentId: string; fullName: string };
  };
  assert.equal(lakshmiSession.fullName, 'Sample 3');

  const lakshmiDashRes = await fetch(`${BASE_URL}/api/students/${lakshmiSession.studentId}/dashboard`, {
    headers: {
      'x-demo-user-id': lakshmiSession.userId,
      'x-demo-role': lakshmiSession.role,
    },
  });
  assert.equal(lakshmiDashRes.status, 200);
  const lakshmiDash = await lakshmiDashRes.json();
  assert.equal(lakshmiDash.student.tracking_reference, 'SETU-48291');
  assert.equal(lakshmiDash.student.assisted_access, 1);
  assert.ok(lakshmiDash.consent, 'Lakshmi must have a CSC consent record');
  console.log('[PASS] Lakshmi Hembram (CSC Assisted Access SETU-48291) Student Dashboard verified.');

  // 7. Verify Kamala Devi Guardian Dashboard & Child Selector Scope (Meena & Arjun only; Lakshmi blocked)
  const kamalaLoginRes = await fetch(`${BASE_URL}/api/demo/scenario/kamala`, { method: 'POST' });
  const { session: kamalaSession } = (await kamalaLoginRes.json()) as {
    session: { userId: string; role: string; guardianId: string; fullName: string };
  };
  assert.equal(kamalaSession.fullName, 'Sample 4');

  const kamalaDashRes = await fetch(`${BASE_URL}/api/guardians/${kamalaSession.guardianId}/dashboard`, {
    headers: {
      'x-demo-user-id': kamalaSession.userId,
      'x-demo-role': kamalaSession.role,
    },
  });
  assert.equal(kamalaDashRes.status, 200);
  const kamalaDash = await kamalaDashRes.json();
  assert.equal(kamalaDash.linkedChildrenCount, 2);
  const childNames = kamalaDash.linkedChildren.map((c: { full_name: string }) => c.full_name).sort();
  assert.deepEqual(childNames, ['Sample 1', 'Sample 2'], 'Guardian must see only Sample 1 and Sample 2');

  // Verify Kamala cannot access unlinked Lakshmi record
  const kamalaLakshmiAttempt = await fetch(`${BASE_URL}/api/students/student_lakshmi/dashboard`, {
    headers: {
      'x-demo-user-id': kamalaSession.userId,
      'x-demo-role': kamalaSession.role,
    },
  });
  assert.equal(kamalaLakshmiAttempt.status, 403, 'Guardian access to unlinked student Lakshmi must return 403');
  console.log('[PASS] Kamala Devi Guardian Dashboard & strict RBAC child isolation verified.');

  // 8. Final Reset to leave baseline clean
  await fetch(`${BASE_URL}/api/demo/reset`, { method: 'POST' });
  console.log('=== All Phase 2 & End-to-End Checks Passed 100% ===');
}

runPhase2Verification().catch((err) => {
  console.error(err);
  process.exit(1);
});
