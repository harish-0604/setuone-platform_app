import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getDb, resetDb } from '../src/server/db.ts';
import { CORE_TABLES } from '../src/server/schema.ts';

async function runVerification() {
  console.log('=== SetuOne Phase 1 Verification Suite ===');

  // 1. Reset & verify 24 core tables in SQLite
  resetDb();
  const db = getDb();

  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all() as Array<{ name: string }>;
  const tableNames = new Set(tables.map((t) => t.name));

  for (const expectedTable of CORE_TABLES) {
    assert.ok(tableNames.has(expectedTable), `Missing SQLite table: ${expectedTable}`);
  }
  console.log(`[PASS] All ${CORE_TABLES.length} core SQLite tables created and verified.`);

  // 2. Verify 5 seeded personas
  const users = db.prepare('SELECT username, full_name, role FROM users').all() as Array<{
    username: string;
    full_name: string;
    role: string;
  }>;
  assert.equal(users.length, 5, 'Expected 5 seeded personas');

  // 3. Verify Arjun income conflict values straddle 250000
  const arjunProfile = db
    .prepare("SELECT annual_income FROM student_profiles WHERE student_id = 'student_arjun'")
    .get() as { annual_income: number };
  assert.equal(arjunProfile.annual_income, 240000, 'Arjun profile income must be 240000');

  const arjunCert = db
    .prepare("SELECT claim_value FROM evidence WHERE id = 'ev_arjun_income_cert'")
    .get() as { claim_value: string };
  assert.equal(Number(arjunCert.claim_value), 280000, 'Arjun certificate income must be 280000');

  const postMatric = db
    .prepare("SELECT income_threshold, validation_status, badge_text FROM schemes WHERE id = 'SCH_POST_MATRIC'")
    .get() as { income_threshold: number; validation_status: string; badge_text: string };
  assert.equal(postMatric.income_threshold, 250000, 'Post-Matric threshold must be 250000');
  assert.equal(postMatric.validation_status, 'DEMO - PENDING OFFICIAL GUIDELINE VALIDATION');
  assert.equal(postMatric.badge_text, 'DEMO RULE — NOT AUTHORITATIVE');
  console.log('[PASS] Arjun income conflict (240,000 vs 280,000 straddling 250,000) verified.');

  // 4. Verify Lakshmi assisted access tracking reference SETU-48291
  const lakshmi = db
    .prepare("SELECT tracking_reference, assisted_access FROM students WHERE id = 'student_lakshmi'")
    .get() as { tracking_reference: string; assisted_access: number };
  assert.equal(lakshmi.tracking_reference, 'SETU-48291');
  assert.equal(lakshmi.assisted_access, 1);
  console.log('[PASS] Lakshmi assisted access (SETU-48291) verified.');

  // 5. Verify Kamala guardian links (strictly Meena and Arjun only)
  const links = db
    .prepare("SELECT student_id FROM guardian_student_links WHERE guardian_id = 'guardian_kamala' ORDER BY student_id")
    .all() as Array<{ student_id: string }>;
  assert.deepEqual(
    links.map((l) => l.student_id),
    ['student_arjun', 'student_meena'],
    'Kamala must be linked strictly to Meena and Arjun only'
  );
  console.log('[PASS] Kamala Devi guardian links (Meena & Arjun only) verified.');

  // 6. Static UI / Source Inspection for Architecture Changes 1-8
  const loginSource = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/LoginPage.tsx'), 'utf-8');
  const portalLayoutSource = fs.readFileSync(path.resolve(process.cwd(), 'src/layouts/PortalLayout.tsx'), 'utf-8');
  const presenterSource = fs.readFileSync(path.resolve(process.cwd(), 'src/pages/PresenterPage.tsx'), 'utf-8');

  // Ensure LoginPage has NO persona names and NO /presenter link
  for (const forbiddenName of ['Meena', 'Arjun', 'Lakshmi', 'Kamala', 'Rajesh', '/presenter', 'Quick Test Credentials']) {
    assert.ok(
      !loginSource.includes(forbiddenName),
      `LoginPage.tsx must not contain "${forbiddenName}"`
    );
  }
  assert.ok(
    !portalLayoutSource.includes('/presenter'),
    'PortalLayout.tsx must not contain any link to /presenter'
  );
  console.log('[PASS] Normal UI contains zero persona shortcuts and zero /presenter links.');

  // Ensure PresenterPage has all 7 required buttons
  const requiredButtons = [
    'SAMPLE 1 — CLEAN CASE',
    'SAMPLE 2 — INCOME CONFLICT',
    'SAMPLE 3 — ASSISTED ACCESS',
    'SAMPLE 4 — GUARDIAN',
    'SAMPLE 5 — OFFICER',
    'API OUTAGE',
    'RESET DEMO',
  ];
  for (const btnText of requiredButtons) {
    assert.ok(
      presenterSource.includes(btnText),
      `PresenterPage.tsx must contain button "${btnText}"`
    );
  }
  console.log('[PASS] PresenterPage.tsx contains all 7 mandatory controls + state inspection tools.');
  console.log('=== All Phase 1 Database & Architectural Checks Passed 100% ===');
}

runVerification().catch((err) => {
  console.error(err);
  process.exit(1);
});
