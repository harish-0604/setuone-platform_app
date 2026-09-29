import express, { Request, Response } from 'express';
import { getDb, resetDb } from './db.ts';
import { CORE_TABLES } from './schema.ts';

export const apiRouter = express.Router();

interface SessionCaller {
  userId: string;
  role: string;
  studentId?: string | null;
  guardianId?: string | null;
}

function getCallerFromHeaders(req: Request): SessionCaller | null {
  const userId = req.header('x-demo-user-id');
  const role = req.header('x-demo-role');
  if (!userId || !role) return null;
  const db = getDb();
  const student = db.prepare('SELECT id FROM students WHERE user_id = ?').get(userId) as { id: string } | undefined;
  const guardian = db.prepare('SELECT id FROM guardians WHERE user_id = ?').get(userId) as { id: string } | undefined;
  return {
    userId,
    role,
    studentId: student?.id ?? null,
    guardianId: guardian?.id ?? null,
  };
}

function buildSessionPayload(userId: string) {
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as Record<string, unknown> | undefined;
  if (!user) return null;

  const student = db.prepare('SELECT * FROM students WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;
  const guardian = db.prepare('SELECT * FROM guardians WHERE user_id = ?').get(userId) as Record<string, unknown> | undefined;

  return {
    userId: user.id,
    username: user.username,
    fullName: user.full_name,
    role: user.role,
    mobile: user.mobile,
    demoId: user.demo_id,
    authMethodLabel: user.auth_method_label,
    studentId: student ? student.id : null,
    guardianId: guardian ? guardian.id : null,
    trackingReference: student ? student.tracking_reference : null,
    simulated: true,
    sessionType: 'DEMO_SESSION_STORAGE',
    disclaimer:
      'SIMULATED DEMO AUTHENTICATION — For SIH prototype evaluation only. Not connected to Aadhaar, DigiLocker, MeriPehchan, Jan Parichay, or any live government identity provider.',
  };
}

function formatTimeShort(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

// ---------------------------------------------------------------------------
// Deterministic Eligibility Engine (Section 11, 13, 14)
// ---------------------------------------------------------------------------
export function runDeterministicEligibilityEvaluation(studentId: string, schemeId: string) {
  const db = getDb();

  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId) as Record<string, unknown> | undefined;
  const profile = db.prepare('SELECT * FROM student_profiles WHERE student_id = ?').get(studentId) as Record<string, unknown> | undefined;
  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(schemeId) as Record<string, unknown> | undefined;

  if (!student || !profile || !scheme) {
    throw new Error('Student, profile, or scheme not found for evaluation');
  }

  const rules = db
    .prepare('SELECT * FROM scheme_rules WHERE scheme_id = ? ORDER BY rowid ASC')
    .all(schemeId) as Array<{
    id: string;
    rule_code: string;
    field: string;
    operator: string;
    expected_value: string;
    description: string;
  }>;

  const evidenceRows = db
    .prepare('SELECT * FROM evidence WHERE student_id = ?')
    .all(studentId) as Array<{
    id: string;
    category: string;
    claim_type: string;
    claim_value: string;
    source: string;
    verification_status: string;
    document_reference: string;
  }>;

  const openConflicts = db
    .prepare("SELECT * FROM conflicts WHERE student_id = ? AND status = 'OPEN'")
    .all(studentId) as Array<{
    id: string;
    type: string;
    affected_rule: string;
    evidence_ids: string;
  }>;

  const evalId = `eval_${studentId}_${schemeId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = new Date().toISOString();

  let overallResult: 'CONDITIONS SATISFIED' | 'REVIEW REQUIRED' | 'CONDITION NOT SATISFIED' =
    'CONDITIONS SATISFIED';
  const ruleResults: Array<{
    id: string;
    evaluation_id: string;
    rule_id: string;
    description: string;
    expected: string;
    actual: string;
    evidence_id: string;
    evidence_source: string;
    status: string;
    reason: string;
    next_action: string;
  }> = [];

  for (const rule of rules) {
    const matchingEvidences = evidenceRows.filter((e) => e.claim_type === rule.field);
    const conflictForRule = openConflicts.find((c) => c.affected_rule === rule.rule_code);

    // Check if there is an active conflict or multiple conflicting evidence items
    const hasConflictEvidence =
      Boolean(conflictForRule) ||
      matchingEvidences.some((e) => e.verification_status === 'CONFLICT') ||
      (matchingEvidences.length > 1 &&
        new Set(matchingEvidences.map((e) => e.claim_value)).size > 1);

    if (hasConflictEvidence) {
      overallResult = 'REVIEW REQUIRED';
      const valuesSummary = matchingEvidences
        .map((e) => `₹${Number(e.claim_value).toLocaleString('en-IN')} (${e.source})`)
        .join(' vs ');
      const evIds = matchingEvidences.map((e) => e.id).join(', ');
      ruleResults.push({
        id: `rr_${evalId}_${rule.rule_code}`,
        evaluation_id: evalId,
        rule_id: rule.rule_code,
        description: rule.description,
        expected: `${rule.operator} ${
          rule.field === 'annual_income'
            ? `₹${Number(rule.expected_value).toLocaleString('en-IN')}`
            : rule.expected_value
        }`,
        actual: `CONFLICT: ${valuesSummary}`,
        evidence_id: evIds || 'ev_conflict',
        evidence_source: matchingEvidences.map((e) => e.document_reference).join(' vs '),
        status: 'REVIEW REQUIRED',
        reason: `Data conflict detected across sources (${valuesSummary}) straddling rule threshold (${rule.operator} ${rule.expected_value}).`,
        next_action: 'Assigned to Scholarship Officer to verify authoritative evidence and resolve conflict.',
      });
      continue;
    }

    const primaryEv = matchingEvidences[0];
    const actualRaw =
      primaryEv !== undefined
        ? primaryEv.claim_value
        : profile[rule.field] !== undefined
        ? String(profile[rule.field])
        : 'UNAVAILABLE';

    let passed = false;
    if (rule.operator === '<=') {
      passed = Number(actualRaw) <= Number(rule.expected_value);
    } else if (rule.operator === '>=') {
      passed = Number(actualRaw) >= Number(rule.expected_value);
    } else if (rule.operator === '==') {
      passed = String(actualRaw) === String(rule.expected_value);
    }

    const formattedExpected =
      rule.field === 'annual_income'
        ? `<= ₹${Number(rule.expected_value).toLocaleString('en-IN')}`
        : `${rule.operator} ${rule.expected_value}`;

    const formattedActual =
      rule.field === 'annual_income' && !Number.isNaN(Number(actualRaw))
        ? `₹${Number(actualRaw).toLocaleString('en-IN')}`
        : String(actualRaw);

    if (passed) {
      ruleResults.push({
        id: `rr_${evalId}_${rule.rule_code}`,
        evaluation_id: evalId,
        rule_id: rule.rule_code,
        description: rule.description,
        expected: formattedExpected,
        actual: formattedActual,
        evidence_id: primaryEv?.id || 'profile_record',
        evidence_source: primaryEv ? `${primaryEv.source} (${primaryEv.document_reference})` : 'Student Profile',
        status: 'CONDITIONS SATISFIED',
        reason: `Verified value (${formattedActual}) satisfies prototype rule (${formattedExpected}).`,
        next_action: 'No action required.',
      });
    } else {
      if (overallResult !== 'REVIEW REQUIRED') {
        overallResult = 'CONDITION NOT SATISFIED';
      }
      ruleResults.push({
        id: `rr_${evalId}_${rule.rule_code}`,
        evaluation_id: evalId,
        rule_id: rule.rule_code,
        description: rule.description,
        expected: formattedExpected,
        actual: formattedActual,
        evidence_id: primaryEv?.id || 'profile_record',
        evidence_source: primaryEv ? `${primaryEv.source} (${primaryEv.document_reference})` : 'Student Profile',
        status: 'CONDITION NOT SATISFIED',
        reason: `Verified value (${formattedActual}) does not meet rule requirement (${formattedExpected}).`,
        next_action: 'Check alternative scheme eligibility or request re-verification if certificate was updated.',
      });
    }
  }

  const summaryReason =
    overallResult === 'CONDITIONS SATISFIED'
      ? `All ${rules.length} rules in ${scheme.active_rule_version} are satisfied with verified evidence.`
      : overallResult === 'REVIEW REQUIRED'
      ? `One or more rules require officer review due to cross-source evidence conflict.`
      : `One or more prototype rule conditions were not satisfied based on verified evidence.`;

  const summaryNextAction =
    overallResult === 'CONDITIONS SATISFIED'
      ? 'Application proceeds automatically via straight-through processing.'
      : overallResult === 'REVIEW REQUIRED'
      ? 'Case assigned to Scholarship Officer for exception resolution (Not Rejected).'
      : 'Student may view detailed rule reason or submit updated income/academic evidence for re-review.';

  db.prepare(`
    INSERT INTO eligibility_evaluations (evaluation_id, student_id, scheme_id, rule_set_version, result, summary_reason, next_action, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    evalId,
    studentId,
    schemeId,
    String(scheme.active_rule_version),
    overallResult,
    summaryReason,
    summaryNextAction,
    nowIso
  );

  const insertRuleRes = db.prepare(`
    INSERT INTO rule_results (id, evaluation_id, rule_id, expected, actual, evidence_id, status, reason, next_action)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const rr of ruleResults) {
    insertRuleRes.run(
      rr.id,
      rr.evaluation_id,
      rr.rule_id,
      rr.expected,
      rr.actual,
      rr.evidence_id,
      rr.status,
      rr.reason,
      rr.next_action
    );
  }

  return {
    evaluation_id: evalId,
    student_id: studentId,
    scheme_id: schemeId,
    scheme_name: scheme.name,
    rule_set_version: scheme.active_rule_version,
    validation_status: scheme.validation_status,
    badge_text: scheme.badge_text,
    income_threshold: scheme.income_threshold,
    result: overallResult,
    summary_reason: summaryReason,
    next_action: summaryNextAction,
    created_at: nowIso,
    rule_results: ruleResults,
  };
}

// ---------------------------------------------------------------------------
// 1. Authentication Endpoints
// ---------------------------------------------------------------------------
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { role, identifier, otp, persona } = req.body as {
    role?: string;
    identifier?: string;
    otp?: string;
    persona?: string;
  };

  if (persona) {
    const map: Record<string, string> = {
      meena: 'user_meena',
      arjun: 'user_arjun',
      lakshmi: 'user_lakshmi',
      kamala: 'user_kamala',
      rajesh: 'user_rajesh',
    };
    const targetUserId = map[persona.toLowerCase()];
    if (!targetUserId) {
      res.status(400).json({ error: 'Unknown demo persona identifier' });
      return;
    }
    const payload = buildSessionPayload(targetUserId);
    res.json({ session: payload });
    return;
  }

  const normalizedRole = (role || 'student').toLowerCase();
  const cleanId = (identifier || '').trim().toUpperCase();

  if (otp !== undefined && String(otp).trim().length < 4) {
    res.status(400).json({ error: 'Please enter a valid 6-digit simulated OTP / passkey (e.g. 123456).' });
    return;
  }

  let matchedUserId = 'user_arjun';

  if (normalizedRole === 'student') {
    if (cleanId.includes('MEENA') || cleanId.includes('SAMPLE 1') || cleanId.includes('SAMPLE1') || cleanId === '9876500001' || cleanId === 'SETU-10492') {
      matchedUserId = 'user_meena';
    } else if (cleanId.includes('LAKSHMI') || cleanId.includes('SAMPLE 3') || cleanId.includes('SAMPLE3') || cleanId === '9876500003' || cleanId === 'SETU-48291') {
      matchedUserId = 'user_lakshmi';
    } else {
      matchedUserId = 'user_arjun';
    }
  } else if (normalizedRole === 'guardian') {
    matchedUserId = 'user_kamala';
  } else if (normalizedRole === 'officer') {
    matchedUserId = 'user_rajesh';
  } else {
    res.status(400).json({ error: 'Invalid role selected for simulated login.' });
    return;
  }

  const session = buildSessionPayload(matchedUserId);
  if (!session) {
    res.status(404).json({ error: 'Seeded demo user not found. Run Demo Reset.' });
    return;
  }

  res.json({ session });
});

apiRouter.post('/auth/logout', (_req: Request, res: Response) => {
  res.json({ status: 'LOGGED_OUT', message: 'Demo session cleared.' });
});

apiRouter.get('/auth/session', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  if (!caller) {
    res.status(401).json({ authenticated: false, session: null });
    return;
  }
  const session = buildSessionPayload(caller.userId);
  res.json({ authenticated: !!session, session });
});

// ---------------------------------------------------------------------------
// 2. Student & Dashboard Endpoints (with strict RBAC)
// ---------------------------------------------------------------------------
function canAccessStudentRecord(caller: SessionCaller | null, targetStudentId: string): boolean {
  if (!caller) return false;
  const db = getDb();
  if (caller.role === 'student') {
    return caller.studentId === targetStudentId;
  }
  if (caller.role === 'guardian') {
    if (!caller.guardianId) return false;
    const link = db
      .prepare('SELECT id FROM guardian_student_links WHERE guardian_id = ? AND student_id = ?')
      .get(caller.guardianId, targetStudentId);
    return !!link;
  }
  if (caller.role === 'officer') {
    return true;
  }
  return false;
}

apiRouter.get('/students/:student_id', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  const { student_id } = req.params;

  if (!canAccessStudentRecord(caller, student_id)) {
    res.status(403).json({
      error: 'FORBIDDEN_ROLE_ACCESS',
      message: 'Access denied: You are only authorized to view your own permitted student records.',
    });
    return;
  }

  const db = getDb();
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id);
  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }
  const profile = db.prepare('SELECT * FROM student_profiles WHERE student_id = ?').get(student_id);
  res.json({ student, profile });
});

apiRouter.get('/students/:student_id/dashboard', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  const { student_id } = req.params;

  if (!canAccessStudentRecord(caller, student_id)) {
    res.status(403).json({
      error: 'FORBIDDEN_ROLE_ACCESS',
      message: 'Access denied: Role-based authorization prevents accessing this student dashboard.',
    });
    return;
  }

  const db = getDb();
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(student_id) as Record<string, unknown> | undefined;
  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return;
  }

  const profile = db.prepare('SELECT * FROM student_profiles WHERE student_id = ?').get(student_id);
  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(String(student.target_scheme_id));
  const application = db.prepare('SELECT * FROM applications WHERE student_id = ?').get(student_id);
  const evaluation = db
    .prepare('SELECT * FROM eligibility_evaluations WHERE student_id = ? ORDER BY rowid DESC LIMIT 1')
    .get(student_id) as { evaluation_id: string } | undefined;

  const ruleResults = evaluation
    ? db.prepare('SELECT * FROM rule_results WHERE evaluation_id = ?').all(evaluation.evaluation_id)
    : [];

  const evidence = db.prepare('SELECT * FROM evidence WHERE student_id = ?').all(student_id);
  const payments = db.prepare('SELECT * FROM payments WHERE student_id = ?').all(student_id);
  const notifications = db
    .prepare('SELECT * FROM notifications WHERE student_id = ? ORDER BY rowid DESC')
    .all(student_id);
  const conflicts = db.prepare('SELECT * FROM conflicts WHERE student_id = ?').all(student_id);
  const exceptions = db.prepare('SELECT * FROM exceptions WHERE student_id = ?').all(student_id);
  const consent = db.prepare('SELECT * FROM consent_records WHERE student_id = ?').get(student_id);
  const retryJobs = db.prepare('SELECT * FROM retry_jobs WHERE student_id = ?').all(student_id);
  const auditLogs = db
    .prepare('SELECT * FROM audit_logs WHERE entity_id = ? ORDER BY rowid ASC')
    .all(student_id);
  const adapters = db.prepare('SELECT * FROM integration_sources').all() as Array<{ status: string }>;
  const outageActive = adapters.some((a) => a.status === 'SERVICE_UNAVAILABLE');

  res.json({
    student,
    profile,
    scheme,
    application,
    evaluation: evaluation ? { ...evaluation, rule_results: ruleResults } : null,
    evidence,
    payments,
    notifications,
    conflicts,
    exceptions,
    consent,
    retryJobs,
    auditLogs,
    adapters,
    outageActive,
  });
});

// ---------------------------------------------------------------------------
// 3. Guardian Dashboard Endpoint (strictly linked children only)
// ---------------------------------------------------------------------------
apiRouter.get('/guardians/:guardian_id/dashboard', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  const { guardian_id } = req.params;

  if (!caller || caller.role !== 'guardian' || caller.guardianId !== guardian_id) {
    res.status(403).json({
      error: 'FORBIDDEN_ROLE_ACCESS',
      message: 'Access denied: Only the authenticated guardian can view their family dashboard.',
    });
    return;
  }

  const db = getDb();
  const guardian = db.prepare('SELECT * FROM guardians WHERE id = ?').get(guardian_id);
  if (!guardian) {
    res.status(404).json({ error: 'Guardian not found' });
    return;
  }

  const linkedStudents = db
    .prepare(`
      SELECT
        s.id as student_id,
        s.full_name,
        s.scenario_tag,
        s.tracking_reference,
        s.profile_completeness,
        gsl.relationship,
        sp.academic_level,
        sp.institution_name,
        sp.district,
        sp.state,
        sp.st_tribe_name,
        sp.annual_income,
        sch.name as scheme_name,
        sch.benefit_summary,
        sch.income_threshold,
        sch.badge_text as scheme_badge,
        sch.active_rule_version,
        app.current_stage,
        app.status as application_status,
        app.where_is_it,
        app.why_here,
        app.owner as stage_owner,
        app.next_action
      FROM guardian_student_links gsl
      JOIN students s ON s.id = gsl.student_id
      LEFT JOIN student_profiles sp ON sp.student_id = s.id
      LEFT JOIN schemes sch ON sch.id = s.target_scheme_id
      LEFT JOIN applications app ON app.student_id = s.id
      WHERE gsl.guardian_id = ?
      ORDER BY s.id ASC
    `)
    .all(guardian_id) as Array<Record<string, unknown>>;

  const enrichedChildren = linkedStudents.map((child) => {
    const sid = String(child.student_id);
    const evidence = db.prepare('SELECT * FROM evidence WHERE student_id = ?').all(sid);
    const payments = db.prepare('SELECT * FROM payments WHERE student_id = ?').all(sid);
    const exceptions = db.prepare('SELECT * FROM exceptions WHERE student_id = ?').all(sid);
    const notifications = db.prepare('SELECT * FROM notifications WHERE student_id = ? ORDER BY rowid DESC').all(sid);
    return {
      ...child,
      evidence,
      payments,
      exceptions,
      notifications,
    };
  });

  res.json({
    guardian,
    linkedChildrenCount: enrichedChildren.length,
    linkedChildren: enrichedChildren,
  });
});

// ---------------------------------------------------------------------------
// 4. Schemes, Eligibility, Evidence, Applications, Payments Endpoints
// ---------------------------------------------------------------------------
apiRouter.get('/schemes', (_req: Request, res: Response) => {
  const db = getDb();
  const schemes = db.prepare('SELECT * FROM schemes ORDER BY rowid ASC').all() as Array<Record<string, unknown>>;
  const enriched = schemes.map((s) => {
    const rules = db.prepare('SELECT * FROM scheme_rules WHERE scheme_id = ?').all(String(s.id));
    return { ...s, rules };
  });
  res.json({ schemes: enriched });
});

apiRouter.get('/schemes/:scheme_id', (req: Request, res: Response) => {
  const db = getDb();
  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(req.params.scheme_id);
  if (!scheme) {
    res.status(404).json({ error: 'Scheme not found' });
    return;
  }
  const rules = db.prepare('SELECT * FROM scheme_rules WHERE scheme_id = ?').all(req.params.scheme_id);
  res.json({ scheme, rules });
});

apiRouter.post('/eligibility/check', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  const { student_id, scheme_id } = req.body as { student_id?: string; scheme_id?: string };
  const targetStudentId = student_id || caller?.studentId;

  if (!targetStudentId || !canAccessStudentRecord(caller, targetStudentId)) {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }

  const db = getDb();
  const student = db.prepare('SELECT target_scheme_id FROM students WHERE id = ?').get(targetStudentId) as
    | { target_scheme_id: string }
    | undefined;
  const targetSchemeId = scheme_id || student?.target_scheme_id || 'SCH_PRE_MATRIC';

  try {
    const evaluation = runDeterministicEligibilityEvaluation(targetStudentId, targetSchemeId);
    res.json({ evaluation });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Evaluation failed' });
  }
});

apiRouter.post('/eligibility/check-all', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  const { student_id } = req.body as { student_id?: string };
  const targetStudentId = student_id || caller?.studentId;

  if (!targetStudentId || !canAccessStudentRecord(caller, targetStudentId)) {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }

  const db = getDb();
  const student = db.prepare('SELECT target_scheme_id FROM students WHERE id = ?').get(targetStudentId) as
    | { target_scheme_id: string }
    | undefined;
  const allSchemes = db.prepare('SELECT id FROM schemes ORDER BY rowid ASC').all() as Array<{ id: string }>;

  try {
    const comparisons = allSchemes.map((s) =>
      runDeterministicEligibilityEvaluation(targetStudentId, s.id)
    );
    // Re-run primary target scheme last so the student's default latest evaluation stays aligned with their target scheme
    if (student?.target_scheme_id) {
      runDeterministicEligibilityEvaluation(targetStudentId, student.target_scheme_id);
    }
    res.json({ comparisons });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Multi-scheme evaluation failed' });
  }
});

apiRouter.get('/eligibility/:student_id', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  const { student_id } = req.params;
  if (!canAccessStudentRecord(caller, student_id)) {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }
  const db = getDb();
  const evaluation = db
    .prepare('SELECT * FROM eligibility_evaluations WHERE student_id = ? ORDER BY rowid DESC LIMIT 1')
    .get(student_id) as Record<string, unknown> | undefined;

  if (!evaluation) {
    res.json({ evaluation: null });
    return;
  }

  const ruleResults = db
    .prepare('SELECT * FROM rule_results WHERE evaluation_id = ?')
    .all(String(evaluation.evaluation_id));
  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(String(evaluation.scheme_id)) as
    | Record<string, unknown>
    | undefined;

  res.json({
    evaluation: {
      ...evaluation,
      scheme_name: scheme?.name,
      validation_status: scheme?.validation_status,
      badge_text: scheme?.badge_text,
      income_threshold: scheme?.income_threshold,
      rule_results: ruleResults,
    },
  });
});

apiRouter.get('/students/:student_id/evidence', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  if (!canAccessStudentRecord(caller, req.params.student_id)) {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }
  const db = getDb();
  const items = db.prepare('SELECT * FROM evidence WHERE student_id = ?').all(req.params.student_id);
  const adapters = db.prepare('SELECT * FROM integration_sources').all();
  res.json({ evidence: items, adapters });
});

apiRouter.post('/students/:student_id/evidence/verify', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  const { student_id } = req.params;
  if (!canAccessStudentRecord(caller, student_id)) {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }
  const db = getDb();
  const adapters = db.prepare('SELECT * FROM integration_sources').all() as Array<{
    id: string;
    adapter_name: string;
    display_name: string;
    status: string;
    simulated_outcome: string;
  }>;
  const outageActive = adapters.some((a) => a.status === 'SERVICE_UNAVAILABLE');
  const items = db.prepare('SELECT * FROM evidence WHERE student_id = ?').all(student_id) as Array<{
    id: string;
    category: string;
    verification_status: string;
  }>;

  if (outageActive) {
    res.json({
      status: 'QUEUED_FOR_RETRY',
      outageActive: true,
      message:
        'External CertificateAdapter / PaymentAdapter returned SERVICE_UNAVAILABLE. Existing verified evidence passport state is preserved and verification refresh is queued for automatic retry.',
      adapters,
      evidence: items,
    });
    return;
  }

  const nowIso = new Date().toISOString();
  for (const ev of items) {
    db.prepare(`
      INSERT INTO verification_results (id, evidence_id, student_id, adapter_name, outcome, details, verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `vr_refresh_${ev.id}_${Date.now()}`,
      ev.id,
      student_id,
      ev.category === 'Identity'
        ? 'IdentityAdapter'
        : ev.category === 'Institution'
        ? 'EducationAdapter'
        : 'CertificateAdapter',
      ev.verification_status,
      `Adapter check completed: status ${ev.verification_status} confirmed.`,
      nowIso
    );
  }

  res.json({
    status: 'VERIFICATION_CONFIRMED',
    outageActive: false,
    message: `All ${items.length} structured evidence items checked against simulated government adapters. Provenance and validity timestamps confirmed.`,
    adapters,
    evidence: items,
  });
});

apiRouter.get('/students/:student_id/applications', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  if (!canAccessStudentRecord(caller, req.params.student_id)) {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }
  const db = getDb();
  const apps = db.prepare('SELECT * FROM applications WHERE student_id = ?').all(req.params.student_id);
  res.json({ applications: apps });
});

apiRouter.get('/students/:student_id/payments', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  if (!canAccessStudentRecord(caller, req.params.student_id)) {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }
  const db = getDb();
  const payments = db.prepare('SELECT * FROM payments WHERE student_id = ?').all(req.params.student_id);
  res.json({ payments });
});

// ---------------------------------------------------------------------------
// 5. Officer Exceptions & Resolution Engine (Section 18, 19, 20, 33, 38)
// ---------------------------------------------------------------------------
apiRouter.get('/exceptions', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  if (!caller || caller.role !== 'officer') {
    res.status(403).json({
      error: 'FORBIDDEN_ROLE_ACCESS',
      message: 'Access denied: Only Scholarship Officers can access the Exception Command Centre.',
    });
    return;
  }

  const db = getDb();
  const rawExceptions = db
    .prepare(`
      SELECT
        e.*,
        s.full_name as student_name,
        s.tracking_reference,
        sp.annual_income as profile_income,
        sp.district,
        sp.state,
        sp.institution_name,
        sch.name as scheme_name,
        sch.income_threshold,
        sch.badge_text as scheme_badge,
        sch.validation_status as scheme_validation_status
      FROM exceptions e
      JOIN students s ON s.id = e.student_id
      LEFT JOIN student_profiles sp ON sp.student_id = e.student_id
      JOIN schemes sch ON sch.id = e.scheme_id
      ORDER BY e.created_at DESC
    `)
    .all() as Array<Record<string, unknown>>;

  const enrichedExceptions = rawExceptions.map((exc) => {
    const evA = db.prepare('SELECT * FROM evidence WHERE id = ?').get(String(exc.evidence_a_id));
    const evB = db.prepare('SELECT * FROM evidence WHERE id = ?').get(String(exc.evidence_b_id));
    const auditTimeline = db
      .prepare('SELECT * FROM audit_logs WHERE entity_id = ? ORDER BY rowid ASC')
      .all(String(exc.student_id));
    const latestEval = db
      .prepare('SELECT * FROM eligibility_evaluations WHERE student_id = ? ORDER BY rowid DESC LIMIT 1')
      .get(String(exc.student_id));
    return {
      ...exc,
      evidence_a: evA,
      evidence_b: evB,
      audit_timeline: auditTimeline,
      latest_evaluation: latestEval,
    };
  });

  const totalApplications = (db.prepare('SELECT COUNT(*) as count FROM applications').get() as { count: number }).count;
  const openExceptions = (
    db.prepare("SELECT COUNT(*) as count FROM exceptions WHERE status IN ('OPEN', 'ASSIGNED', 'IN_REVIEW', 'ESCALATED')").get() as {
      count: number;
    }
  ).count;
  const resolvedExceptions = (
    db.prepare("SELECT COUNT(*) as count FROM exceptions WHERE status IN ('RESOLVED', 'CLOSED')").get() as {
      count: number;
    }
  ).count;
  const straightThroughCases = totalApplications - openExceptions - resolvedExceptions;

  const outreachCandidates = db.prepare('SELECT * FROM outreach_candidates ORDER BY rowid ASC').all();

  res.json({
    metrics: {
      totalCases: totalApplications,
      straightThroughCases: Math.max(2, straightThroughCases),
      openExceptions,
      resolvedCases: resolvedExceptions,
    },
    exceptions: enrichedExceptions,
    outreachCandidates,
  });
});

apiRouter.get('/exceptions/:exception_id', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  if (!caller || caller.role !== 'officer') {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }
  const db = getDb();
  const exc = db.prepare('SELECT * FROM exceptions WHERE id = ?').get(req.params.exception_id) as
    | Record<string, unknown>
    | undefined;
  if (!exc) {
    res.status(404).json({ error: 'Exception not found' });
    return;
  }
  const evA = db.prepare('SELECT * FROM evidence WHERE id = ?').get(String(exc.evidence_a_id));
  const evB = db.prepare('SELECT * FROM evidence WHERE id = ?').get(String(exc.evidence_b_id));
  const auditTimeline = db
    .prepare('SELECT * FROM audit_logs WHERE entity_id = ? ORDER BY rowid ASC')
    .all(String(exc.student_id));
  res.json({ exception: { ...exc, evidence_a: evA, evidence_b: evB, audit_timeline: auditTimeline } });
});

// Section 19 & 33: Important Resolution Rule (8 Mandatory Backend Steps)
apiRouter.post('/exceptions/:exception_id/resolve', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  if (!caller || caller.role !== 'officer') {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }

  const { exception_id } = req.params;
  const { accepted_value, accepted_source, notes } = req.body as {
    accepted_value?: number | string;
    accepted_source?: string;
    notes?: string;
  };

  const db = getDb();
  const exc = db.prepare('SELECT * FROM exceptions WHERE id = ?').get(exception_id) as
    | Record<string, unknown>
    | undefined;
  if (!exc) {
    res.status(404).json({ error: 'Exception not found' });
    return;
  }

  const studentId = String(exc.student_id);
  const schemeId = String(exc.scheme_id);
  const resolvedIncome = Number(accepted_value ?? 240000);
  const sourceLabel = accepted_source || (resolvedIncome <= 250000 ? 'Verified Profile / Corrected Income Certificate' : 'State e-District Income Certificate (Confirmed)');
  const officerName = 'SAMPLE 5';
  const timeShort = formatTimeShort();
  const nowIso = new Date().toISOString();

  // Step 1: Update exception & conflict status
  db.prepare("UPDATE exceptions SET status = 'RESOLVED', updated_at = ? WHERE id = ?").run(nowIso, exception_id);
  db.prepare("UPDATE conflicts SET status = 'RESOLVED' WHERE id = ?").run(String(exc.conflict_id));

  // Step 2: Store updated/corrected evidence & profile value
  db.prepare('UPDATE student_profiles SET annual_income = ?, updated_at = ? WHERE student_id = ?').run(
    resolvedIncome,
    nowIso,
    studentId
  );
  db.prepare(`
    UPDATE evidence
    SET claim_value = ?, verification_status = 'VERIFIED', retrieved_at = ?
    WHERE student_id = ? AND claim_type = 'annual_income'
  `).run(String(resolvedIncome), nowIso, studentId);

  // Step 3: Write audit event for officer evidence correction / resolution
  db.prepare(`
    INSERT INTO audit_logs (id, timestamp, actor, action, entity, entity_id, before_state, after_state, rule_version, evidence_reference)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `audit_res_${Date.now()}_1`,
    timeShort,
    officerName,
    `Evidence corrected & conflict resolved (Confirmed Income: ₹${resolvedIncome.toLocaleString('en-IN')})`,
    'resolution',
    studentId,
    'CONFLICT (₹2,40,000 vs ₹2,80,000)',
    `VERIFIED (₹${resolvedIncome.toLocaleString('en-IN')} via ${sourceLabel})`,
    String(exc.rule_version),
    `${exc.evidence_a_id}, ${exc.evidence_b_id}`
  );

  // Step 4 & 5: Run eligibility engine again and create new eligibility evaluation
  db.prepare(`
    INSERT INTO audit_logs (id, timestamp, actor, action, entity, entity_id, before_state, after_state, rule_version, evidence_reference)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `audit_res_${Date.now()}_2`,
    timeShort,
    'SYSTEM',
    'Eligibility re-evaluation started',
    're-evaluation',
    studentId,
    'REVIEW REQUIRED',
    'RE_EVALUATING',
    String(exc.rule_version),
    String(exc.id)
  );

  const newEvaluation = runDeterministicEligibilityEvaluation(studentId, schemeId);

  // Step 6: Update application state & payment status based on genuine re-evaluation outcome
  if (newEvaluation.result === 'CONDITIONS SATISFIED') {
    db.prepare(`
      UPDATE applications
      SET current_stage = 'SANCTIONED',
          status = 'CONDITIONS SATISFIED',
          where_is_it = 'State Tribal Welfare Sanction & DBT Desk',
          why_here = 'Officer Sample 5 resolved INCOME_CONFLICT (confirmed ₹2,40,000 <= ₹2,50,000 threshold). Eligibility re-evaluation passed.',
          owner = 'DBT Disbursement System',
          next_action = 'No student action required. Sanctioned after officer resolution and queued for DBT.',
          updated_at = ?
      WHERE student_id = ?
    `).run(nowIso, studentId);

    db.prepare(`
      UPDATE payments
      SET sanction_status = 'SANCTIONED',
          payment_status = 'DBT Queued (Post-Resolution)',
          last_updated = ?
      WHERE student_id = ?
    `).run('2026-09-28 10:56 IST', studentId);
  } else {
    db.prepare(`
      UPDATE applications
      SET current_stage = 'ELIGIBILITY_CHECKED',
          status = 'CONDITION NOT SATISFIED',
          where_is_it = 'Student Portal — Eligibility Outcome Notice',
          why_here = 'Officer Sample 5 confirmed authoritative certificate income of ₹2,80,000, which exceeds the ₹2,50,000 Post-Matric threshold.',
          owner = 'Student (Re-Review / Alternative Scheme Option)',
          next_action = 'Confirmed income (₹2,80,000) exceeds Post-Matric limit (₹2,50,000). Check Top Class / National Scholarship (threshold ₹8,00,000) or submit revised income certificate.',
          updated_at = ?
      WHERE student_id = ?
    `).run(nowIso, studentId);

    db.prepare(`
      UPDATE payments
      SET sanction_status = 'NOT_SANCTIONED',
          payment_status = 'Ineligible under Post-Matric Income Rule',
          last_updated = ?
      WHERE student_id = ?
    `).run('2026-09-28 10:56 IST', studentId);
  }

  // Record resolution row
  db.prepare(`
    INSERT INTO resolutions (id, exception_id, officer_id, accepted_source, accepted_value, resolution_notes, new_evaluation_id, new_result, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `res_${Date.now()}`,
    exception_id,
    caller.userId,
    sourceLabel,
    String(resolvedIncome),
    notes || `Officer resolved INCOME_CONFLICT with authoritative value ₹${resolvedIncome.toLocaleString('en-IN')}.`,
    newEvaluation.evaluation_id,
    newEvaluation.result,
    nowIso
  );

  // Create notification for student
  db.prepare(`
    INSERT INTO notifications (id, student_id, event_type, title, message, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `notif_res_${Date.now()}`,
    studentId,
    'EXCEPTION_RESOLVED',
    `Officer Resolution Complete: ${newEvaluation.result}`,
    `Scholarship Officer Sample 5 resolved your income conflict (Confirmed: ₹${resolvedIncome.toLocaleString('en-IN')}). Automatic re-evaluation result: ${newEvaluation.result}.`,
    0,
    nowIso
  );

  // Step 7: Write second audit event for re-evaluation outcome
  db.prepare(`
    INSERT INTO audit_logs (id, timestamp, actor, action, entity, entity_id, before_state, after_state, rule_version, evidence_reference)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `audit_res_${Date.now()}_3`,
    timeShort,
    'SYSTEM',
    newEvaluation.result === 'CONDITIONS SATISFIED'
      ? 'Eligibility conditions satisfied'
      : 'Eligibility condition not satisfied (Income > ₹2,50,000)',
    're-evaluation',
    studentId,
    'REVIEW REQUIRED',
    newEvaluation.result,
    String(exc.rule_version),
    newEvaluation.evaluation_id
  );

  // Step 8: Return updated status to frontend
  res.json({
    status: 'RESOLVED',
    exceptionId: exception_id,
    acceptedValue: resolvedIncome,
    evaluation: newEvaluation,
  });
});

apiRouter.post('/exceptions/:exception_id/request-info', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  if (!caller || caller.role !== 'officer') {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }
  const { exception_id } = req.params;
  const db = getDb();
  const exc = db.prepare('SELECT * FROM exceptions WHERE id = ?').get(exception_id) as Record<string, unknown> | undefined;
  if (!exc) {
    res.status(404).json({ error: 'Exception not found' });
    return;
  }
  const nowIso = new Date().toISOString();
  db.prepare("UPDATE exceptions SET status = 'IN_REVIEW', updated_at = ? WHERE id = ?").run(nowIso, exception_id);
  db.prepare(`
    INSERT INTO notifications (id, student_id, event_type, title, message, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    `notif_req_${Date.now()}`,
    String(exc.student_id),
    'ACTION_REQUIRED',
    'Officer Requested Additional Clarification',
    'Scholarship Officer Sample 5 requested clarification regarding your income certificate mismatch.',
    0,
    nowIso
  );
  res.json({ status: 'IN_REVIEW', exceptionId: exception_id });
});

apiRouter.post('/exceptions/:exception_id/escalate', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  if (!caller || caller.role !== 'officer') {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }
  const { exception_id } = req.params;
  const db = getDb();
  const exc = db.prepare('SELECT * FROM exceptions WHERE id = ?').get(exception_id) as Record<string, unknown> | undefined;
  if (!exc) {
    res.status(404).json({ error: 'Exception not found' });
    return;
  }
  const nowIso = new Date().toISOString();
  db.prepare("UPDATE exceptions SET status = 'ESCALATED', owner = 'State Nodal Scholarship Appellate Officer', updated_at = ? WHERE id = ?").run(
    nowIso,
    exception_id
  );
  db.prepare(`
    INSERT INTO audit_logs (id, timestamp, actor, action, entity, entity_id, before_state, after_state, rule_version, evidence_reference)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    `audit_esc_${Date.now()}`,
    formatTimeShort(),
    'SAMPLE 5',
    'Case escalated to State Nodal Appellate Officer',
    'exception',
    String(exc.student_id),
    String(exc.status),
    'ESCALATED',
    String(exc.rule_version),
    exception_id
  );
  res.json({ status: 'ESCALATED', exceptionId: exception_id });
});

apiRouter.post('/exceptions/:exception_id/reevaluate', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  if (!caller || caller.role !== 'officer') {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }
  const { exception_id } = req.params;
  const db = getDb();
  const exc = db.prepare('SELECT * FROM exceptions WHERE id = ?').get(exception_id) as Record<string, unknown> | undefined;
  if (!exc) {
    res.status(404).json({ error: 'Exception not found' });
    return;
  }
  const evaluation = runDeterministicEligibilityEvaluation(String(exc.student_id), String(exc.scheme_id));
  res.json({ evaluation });
});

apiRouter.get('/audit/:entity_type/:entity_id', (req: Request, res: Response) => {
  const db = getDb();
  const { entity_type, entity_id } = req.params;
  const logs = db
    .prepare('SELECT * FROM audit_logs WHERE entity = ? OR entity_id = ? ORDER BY rowid ASC')
    .all(entity_type, entity_id);
  res.json({ auditLogs: logs });
});

apiRouter.get('/outreach/candidates', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  if (!caller || caller.role !== 'officer') {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }
  const db = getDb();
  const candidates = db.prepare('SELECT * FROM outreach_candidates ORDER BY rowid ASC').all();
  res.json({ candidates });
});

apiRouter.get('/consent/:student_id', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  if (!canAccessStudentRecord(caller, req.params.student_id)) {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }
  const db = getDb();
  const consent = db.prepare('SELECT * FROM consent_records WHERE student_id = ?').get(req.params.student_id);
  res.json({ consent: consent || null });
});

apiRouter.post('/jago/ask', (req: Request, res: Response) => {
  const caller = getCallerFromHeaders(req);
  const { student_id, question } = req.body as { student_id?: string; question?: string };
  const targetStudentId = student_id || caller?.studentId;

  if (!targetStudentId || !canAccessStudentRecord(caller, targetStudentId)) {
    res.status(403).json({ error: 'FORBIDDEN_ROLE_ACCESS' });
    return;
  }

  const db = getDb();
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(targetStudentId) as Record<string, unknown> | undefined;
  const application = db.prepare('SELECT * FROM applications WHERE student_id = ?').get(targetStudentId) as Record<string, unknown> | undefined;
  const scheme = student
    ? (db.prepare('SELECT * FROM schemes WHERE id = ?').get(String(student.target_scheme_id)) as Record<string, unknown> | undefined)
    : undefined;
  const evidence = db.prepare('SELECT * FROM evidence WHERE student_id = ?').all(targetStudentId) as Array<Record<string, unknown>>;
  const exceptions = db.prepare('SELECT * FROM exceptions WHERE student_id = ?').all(targetStudentId) as Array<Record<string, unknown>>;
  const payments = db.prepare('SELECT * FROM payments WHERE student_id = ?').all(targetStudentId) as Array<Record<string, unknown>>;

  const q = String(question || '').trim().toLowerCase();
  const openExc = exceptions.find((e) => e.status !== 'RESOLVED' && e.status !== 'CLOSED');
  const conflictEvs = evidence.filter((e) => e.verification_status === 'CONFLICT');
  const missingEvs = evidence.filter(
    (e) =>
      e.verification_status === 'PENDING' ||
      e.verification_status === 'UNAVAILABLE' ||
      e.verification_status === 'EXPIRED'
  );
  const payment = payments[0];

  let answer =
    'I cannot confirm that from the available information. Please use the official assistance or review route.';

  if (q.includes('application status') || q === 'what is my application status?') {
    answer = application
      ? `Current Application Status: ${application.status} (Stage: ${application.current_stage}). Location: ${application.where_is_it}. Reason: ${application.why_here}`
      : answer;
  } else if (q.includes('document is missing') || q.includes('missing') || q === 'what document is missing?') {
    if (conflictEvs.length > 0) {
      answer = `No document is missing, conflict detected: ${conflictEvs
        .map((e) => `${e.category} (₹${Number(e.claim_value).toLocaleString('en-IN')} from ${e.source})`)
        .join(' vs ')}. Status: REVIEW REQUIRED.`;
    } else if (missingEvs.length === 0) {
      answer = `All ${evidence.length} structured evidence items in your Evidence Passport are currently VERIFIED. No document is missing.`;
    } else {
      answer = `Pending/Unavailable documents: ${missingEvs.map((e) => `${e.category} (${e.verification_status})`).join(', ')}.`;
    }
  } else if (q.includes('do next') || q.includes('next action') || q === 'what should i do next?') {
    if (openExc && application) {
      answer = `Next Action: ${application.next_action} Your case (${openExc.type}) is assigned to ${openExc.owner} and is NOT rejected.`;
    } else if (application) {
      answer = `Next Action: ${application.next_action}`;
    }
  } else if (q.includes('payment status') || q.includes('dbt') || q === 'what is my payment status?') {
    if (payment) {
      answer = `Payment Status (DEMO DATA): ${payment.payment_status} • Sanction Status: ${payment.sanction_status} • Amount: ₹${Number(
        payment.amount
      ).toLocaleString('en-IN')} (${payment.scheme}, AY ${payment.academic_year}). Last Updated: ${
        payment.last_updated
      }. Source: ${payment.source}.`;
    } else {
      answer = 'No payment record is currently available in the system.';
    }
  } else if (
    q.includes('scholarship require') ||
    q.includes('require') ||
    q === 'what does this scholarship require?'
  ) {
    if (scheme) {
      answer = `${scheme.name} (${scheme.active_rule_version} — DEMO RULE — NOT AUTHORITATIVE) requires: Verified ST certificate, annual family income <= ₹${Number(
        scheme.income_threshold
      ).toLocaleString('en-IN')}, verified institution enrollment, and zero overlapping central/state scholarship benefit.`;
    }
  }

  res.json({
    question: question || '',
    answer,
    deterministic: true,
    student_id: targetStudentId,
  });
});

// ---------------------------------------------------------------------------
// 6. Demo & Presenter Control Centre Endpoints
// ---------------------------------------------------------------------------
apiRouter.post('/demo/reset', (_req: Request, res: Response) => {
  resetDb();
  res.json({
    status: 'RESET_COMPLETE',
    message:
      'SQLite database dropped, recreated, and re-seeded to clean baseline (Sample 1 clean case, Sample 2 income conflict, Sample 3 assisted access, Sample 4 guardian links, Sample 5 officer queue).',
    timestamp: new Date().toISOString(),
  });
});

apiRouter.post('/demo/scenario/meena', (_req: Request, res: Response) => {
  const session = buildSessionPayload('user_meena');
  res.json({
    scenario: 'MEENA — CLEAN CASE',
    session,
    redirectTo: '/student',
  });
});

apiRouter.post('/demo/scenario/arjun', (_req: Request, res: Response) => {
  // Ensure Arjun's canonical INCOME_CONFLICT state is active when this scenario button is clicked
  const db = getDb();
  const openExc = db
    .prepare("SELECT id FROM exceptions WHERE student_id = 'student_arjun' AND status IN ('OPEN', 'ASSIGNED', 'IN_REVIEW')")
    .get();
  if (!openExc) {
    resetDb();
  }
  const session = buildSessionPayload('user_arjun');
  res.json({
    scenario: 'ARJUN — INCOME CONFLICT',
    session,
    redirectTo: '/student',
  });
});

apiRouter.post('/demo/scenario/lakshmi', (_req: Request, res: Response) => {
  const session = buildSessionPayload('user_lakshmi');
  res.json({
    scenario: 'LAKSHMI — ASSISTED ACCESS',
    session,
    redirectTo: '/student',
  });
});

apiRouter.post('/demo/scenario/kamala', (_req: Request, res: Response) => {
  const session = buildSessionPayload('user_kamala');
  res.json({
    scenario: 'KAMALA — GUARDIAN',
    session,
    redirectTo: '/guardian',
  });
});

apiRouter.post('/demo/scenario/rajesh', (_req: Request, res: Response) => {
  const session = buildSessionPayload('user_rajesh');
  res.json({
    scenario: 'RAJESH — OFFICER',
    session,
    redirectTo: '/officer',
  });
});

apiRouter.post('/demo/fault/api-outage', (_req: Request, res: Response) => {
  const db = getDb();
  const certAdapter = db
    .prepare("SELECT status FROM integration_sources WHERE adapter_name = 'CertificateAdapter'")
    .get() as { status: string } | undefined;

  const isCurrentlyDown = certAdapter?.status === 'SERVICE_UNAVAILABLE';
  const nextStatus = isCurrentlyDown ? 'OPERATIONAL' : 'SERVICE_UNAVAILABLE';
  const nextOutcome = isCurrentlyDown ? 'VERIFIED' : 'SERVICE_UNAVAILABLE';
  const now = new Date().toISOString();

  db.prepare(
    "UPDATE integration_sources SET status = ?, simulated_outcome = ?, last_checked = ? WHERE adapter_name IN ('CertificateAdapter', 'PaymentAdapter')"
  ).run(nextStatus, nextOutcome, now);

  if (!isCurrentlyDown) {
    db.prepare('DELETE FROM retry_jobs WHERE id = ?').run('retry_arjun_outage');
    db.prepare(`
      INSERT INTO retry_jobs (id, student_id, application_id, service_name, status, attempt_count, last_known_state, next_retry_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'retry_arjun_outage',
      'student_arjun',
      'app_arjun',
      'CertificateAdapter',
      'QUEUED_FOR_RETRY',
      1,
      'EVIDENCE_VERIFIED (Preserved — Not Rejected)',
      'In 15 minutes (Auto-Retry)',
      now
    );

    db.prepare('DELETE FROM notifications WHERE id = ?').run('notif_arjun_outage');
    db.prepare(`
      INSERT INTO notifications (id, student_id, event_type, title, message, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      'notif_arjun_outage',
      'student_arjun',
      'ACTION_REQUIRED',
      'Verification service temporarily unavailable. Your application remains active.',
      'External CertificateAdapter returned SERVICE_UNAVAILABLE. Your application has NOT been rejected and is queued for automatic retry (QUEUED_FOR_RETRY).',
      0,
      now
    );

    db.prepare(`
      UPDATE payments
      SET source = 'Temporarily unavailable',
          freshness = 'Last Authoritative Simulated State Preserved'
      WHERE student_id IN ('student_meena', 'student_arjun', 'student_lakshmi')
    `).run();
  } else {
    db.prepare('DELETE FROM retry_jobs WHERE id = ?').run('retry_arjun_outage');
    db.prepare(`
      UPDATE payments
      SET source = 'DEMO DATA — Simulated PFMS Adapter',
          freshness = 'AUTHORITATIVE_SIMULATED'
      WHERE student_id IN ('student_meena', 'student_arjun', 'student_lakshmi')
    `).run();
  }

  res.json({
    outageActive: !isCurrentlyDown,
    adapterStatus: nextStatus,
    queueState: !isCurrentlyDown ? 'QUEUED_FOR_RETRY' : 'NORMAL',
    message: !isCurrentlyDown
      ? 'Simulated API Outage ACTIVE: CertificateAdapter & PaymentAdapter set to SERVICE_UNAVAILABLE. Requests queued for retry (never rejected).'
      : 'Simulated API Outage CLEARED: External adapters restored to OPERATIONAL.',
  });
});

apiRouter.get('/demo/state', (_req: Request, res: Response) => {
  const db = getDb();
  const tableCounts: Record<string, number> = {};
  for (const table of CORE_TABLES) {
    const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
    tableCounts[table] = row.count;
  }

  const users = db.prepare('SELECT * FROM users').all();
  const students = db
    .prepare(`
      SELECT s.*, sp.annual_income, sp.st_tribe_name, sp.academic_level, sp.institution_name
      FROM students s
      LEFT JOIN student_profiles sp ON sp.student_id = s.id
    `)
    .all();
  const guardianLinks = db
    .prepare(`
      SELECT gsl.*, g.full_name as guardian_name, s.full_name as student_name
      FROM guardian_student_links gsl
      JOIN guardians g ON g.id = gsl.guardian_id
      JOIN students s ON s.id = gsl.student_id
    `)
    .all();
  const schemes = db.prepare('SELECT * FROM schemes').all();
  const evidence = db.prepare('SELECT * FROM evidence').all();
  const conflicts = db.prepare('SELECT * FROM conflicts').all();
  const exceptions = db.prepare('SELECT * FROM exceptions').all();
  const applications = db.prepare('SELECT * FROM applications').all();
  const evaluations = db.prepare('SELECT * FROM eligibility_evaluations').all();
  const payments = db.prepare('SELECT * FROM payments').all();
  const adapters = db.prepare('SELECT * FROM integration_sources').all() as Array<{
    adapter_name: string;
    status: string;
  }>;
  const retryJobs = db.prepare('SELECT * FROM retry_jobs').all();
  const auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY rowid ASC').all();
  const consentRecords = db.prepare('SELECT * FROM consent_records').all();

  const outageActive = adapters.some((a) => a.status === 'SERVICE_UNAVAILABLE');

  res.json({
    databaseEngine: 'SQLite (setuone.db)',
    totalTables: CORE_TABLES.length,
    tableCounts,
    outageActive,
    users,
    students,
    guardianLinks,
    schemes,
    evidence,
    conflicts,
    exceptions,
    applications,
    evaluations,
    payments,
    adapters,
    retryJobs,
    auditLogs,
    consentRecords,
  });
});
