import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { CORE_TABLES, createTables } from './schema.ts';

export function seedDatabase(db: DatabaseSync): void {
  createTables(db);

  // Check if already seeded
  const existingUsers = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (existingUsers.count > 0) {
    return;
  }

  const now = '2026-09-28T10:30:00Z';

  // 1. Seed Users (5 Personas)
  const insertUser = db.prepare(`
    INSERT INTO users (id, username, full_name, role, mobile, demo_id, auth_method_label, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('user_meena', 'meena', 'Meena Murmu', 'student', '9876500001', 'STU-MEENA', 'Demo Mobile OTP / Simulated Locker Login', now);
  insertUser.run('user_arjun', 'arjun', 'Arjun Murmu', 'student', '9876500002', 'STU-ARJUN', 'Demo Mobile OTP / Simulated Locker Login', now);
  insertUser.run('user_lakshmi', 'lakshmi', 'Lakshmi Hembram', 'student', '9876500003', 'STU-LAKSHMI', 'Demo Assisted Access / Simulated OTP Login', now);
  insertUser.run('user_kamala', 'kamala', 'Kamala Devi', 'guardian', '9876500010', 'GRD-KAMALA', 'Demo Guardian Mobile OTP', now);
  insertUser.run('user_rajesh', 'rajesh', 'Rajesh Kumar', 'officer', '9876500020', 'OFF-RAJESH', 'Demo Government Officer SSO', now);

  // 2. Seed Schemes & Versioned Rules from JSON
  const rulesPath = path.resolve(process.cwd(), 'src/server/rules/schemes_v0_1.json');
  const rawSchemes = JSON.parse(fs.readFileSync(rulesPath, 'utf-8'));

  const insertScheme = db.prepare(`
    INSERT INTO schemes (id, name, code, description, benefit_summary, active_rule_version, validation_status, badge_text, income_threshold)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRuleVersion = db.prepare(`
    INSERT INTO scheme_rule_versions (id, scheme_id, rule_set_id, version, source_label, effective_date, validation_status, raw_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRule = db.prepare(`
    INSERT INTO scheme_rules (id, rule_version_id, scheme_id, rule_code, field, operator, expected_value, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const s of rawSchemes) {
    const incomeRule = s.rules.find((r: { field: string }) => r.field === 'annual_income');
    const threshold = incomeRule ? Number(incomeRule.value) : 250000;
    const versionId = `rv_${s.scheme_id}_${s.version}`;

    insertScheme.run(
      s.scheme_id,
      s.scheme,
      s.rule_set_id,
      s.description,
      s.benefit_summary,
      `${s.rule_set_id} ${s.version}`,
      s.validation_status,
      s.badge,
      threshold
    );

    insertRuleVersion.run(
      versionId,
      s.scheme_id,
      s.rule_set_id,
      s.version,
      s.source_label,
      s.effective_date,
      s.validation_status,
      JSON.stringify(s)
    );

    for (const r of s.rules) {
      insertRule.run(
        `${s.scheme_id}_${r.id}`,
        versionId,
        s.scheme_id,
        r.id,
        r.field,
        r.operator,
        String(r.value),
        r.description
      );
    }
  }

  // 3. Seed Students
  const insertStudent = db.prepare(`
    INSERT INTO students (id, user_id, full_name, scenario_tag, target_scheme_id, tracking_reference, assisted_access, csc_centre_id, profile_completeness, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStudent.run('student_meena', 'user_meena', 'Meena Murmu', 'Clean Case', 'SCH_PRE_MATRIC', 'SETU-10492', 0, null, 100, now);
  insertStudent.run('student_arjun', 'user_arjun', 'Arjun Murmu', 'Income Conflict', 'SCH_POST_MATRIC', 'SETU-20841', 0, null, 100, now);
  insertStudent.run('student_lakshmi', 'user_lakshmi', 'Lakshmi Hembram', 'Assisted Access', 'SCH_POST_MATRIC', 'SETU-48291', 1, 'CSC-JH-KHUNTI-019', 95, now);

  // 4. Seed Student Profiles
  const insertProfile = db.prepare(`
    INSERT INTO student_profiles (
      id, student_id, state, district, community_category, st_tribe_name, st_status,
      annual_income, academic_level, academic_category, institution_name, institution_verified,
      attendance_percentage, previous_marks_percentage, existing_scholarship_benefit, identity_status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertProfile.run(
    'prof_meena', 'student_meena', 'Jharkhand', 'Ranchi', 'ST', 'Santhal', 'VERIFIED',
    120000, 'Class 9 (Secondary)', 'PRE_MATRIC', 'Govt. High School, Kanke, Ranchi', 1,
    92.5, 81.0, 0, 'MATCHED', now
  );

  // Arjun: Profile-declared income ₹2,40,000 (straddles ₹2,50,000 limit against ₹2,80,000 certificate!)
  insertProfile.run(
    'prof_arjun', 'student_arjun', 'Jharkhand', 'Ranchi', 'ST', 'Santhal', 'VERIFIED',
    240000, 'B.Sc. Year 1 (Undergraduate)', 'POST_MATRIC', 'Ranchi University, Ranchi', 1,
    88.0, 76.5, 0, 'MATCHED', now
  );

  insertProfile.run(
    'prof_lakshmi', 'student_lakshmi', 'Jharkhand', 'Khunti', 'ST', 'Munda', 'VERIFIED',
    145000, 'Class 11 (Higher Secondary)', 'POST_MATRIC', 'Govt. Plus Two High School, Khunti', 1,
    86.0, 74.0, 0, 'MATCHED', now
  );

  // 5. Seed Guardian & Links (Kamala Devi -> strictly Meena and Arjun only)
  db.prepare(`
    INSERT INTO guardians (id, user_id, full_name, relationship, district, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('guardian_kamala', 'user_kamala', 'Kamala Devi', 'Mother', 'Ranchi, Jharkhand', now);

  const insertLink = db.prepare(`
    INSERT INTO guardian_student_links (id, guardian_id, student_id, relationship, linked_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertLink.run('link_kamala_meena', 'guardian_kamala', 'student_meena', 'Mother', now);
  insertLink.run('link_kamala_arjun', 'guardian_kamala', 'student_arjun', 'Mother', now);

  // 6. Seed Evidence (6 structured categories per student)
  const insertEvidence = db.prepare(`
    INSERT INTO evidence (
      id, student_id, category, claim_type, claim_value, source, source_type,
      verification_status, retrieved_at, valid_until, verification_method, confidence, document_reference
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Meena Evidence (All VERIFIED)
  insertEvidence.run('ev_meena_identity', 'student_meena', 'Identity', 'student_identity', 'Meena Murmu (DOB: 2011-05-14)', 'Simulated Identity Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2030-12-31', 'DEMO_DEMOGRAPHIC_MATCH', 0.99, 'DEMO-ID-JH-1001');
  insertEvidence.run('ev_meena_st', 'student_meena', 'ST Status', 'st_status', 'VERIFIED', 'State Caste Certificate Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2035-12-31', 'DEMO_CERTIFICATE_SIGNATURE', 0.99, 'CERT-ST-JH-10492');
  insertEvidence.run('ev_meena_income', 'student_meena', 'Income', 'annual_income', '120000', 'State e-District Income Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2027-03-31', 'DEMO_CERTIFICATE_VERIFY', 0.98, 'CERT-INC-JH-10492');
  insertEvidence.run('ev_meena_academic', 'student_meena', 'Academic', 'academic_category', 'PRE_MATRIC', 'State Education Portal Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2027-05-31', 'DEMO_ENROLLMENT_CHECK', 0.99, 'ACA-JH-IX-10492');
  insertEvidence.run('ev_meena_inst', 'student_meena', 'Institution', 'institution_verified', '1', 'UDISE+ Institution Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2027-05-31', 'DEMO_INSTITUTION_ATTESTATION', 1.0, 'INST-UDISE-201401');
  insertEvidence.run('ev_meena_benefit', 'student_meena', 'Existing Benefit', 'existing_scholarship_benefit', '0', 'NSP Deduplication Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2027-03-31', 'DEMO_CROSS_SCHEME_CHECK', 0.99, 'DEDUP-NSP-10492');

  // Arjun Evidence (Income Conflict: ₹2,40,000 Profile vs ₹2,80,000 Certificate straddling ₹2,50,000 Post-Matric threshold)
  insertEvidence.run('ev_arjun_identity', 'student_arjun', 'Identity', 'student_identity', 'Arjun Murmu (DOB: 2007-08-22)', 'Simulated Identity Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2030-12-31', 'DEMO_DEMOGRAPHIC_MATCH', 0.99, 'DEMO-ID-JH-2002');
  insertEvidence.run('ev_arjun_st', 'student_arjun', 'ST Status', 'st_status', 'VERIFIED', 'State Caste Certificate Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2035-12-31', 'DEMO_CERTIFICATE_SIGNATURE', 0.99, 'CERT-ST-JH-20841');
  insertEvidence.run('ev_arjun_income_profile', 'student_arjun', 'Income', 'annual_income', '240000', 'Student Profile Declaration', 'SELF_DECLARED', 'CONFLICT', now, '2027-03-31', 'STUDENT_DECLARATION', 0.80, 'PROF-DECL-20841');
  insertEvidence.run('ev_arjun_income_cert', 'student_arjun', 'Income', 'annual_income', '280000', 'State e-District Income Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'CONFLICT', now, '2027-03-31', 'DEMO_CERTIFICATE_VERIFY', 0.95, 'CERT-INC-JH-88412');
  insertEvidence.run('ev_arjun_academic', 'student_arjun', 'Academic', 'academic_category', 'POST_MATRIC', 'University Enrollment Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2027-06-30', 'DEMO_ENROLLMENT_CHECK', 0.98, 'ACA-RU-BSC1-20841');
  insertEvidence.run('ev_arjun_inst', 'student_arjun', 'Institution', 'institution_verified', '1', 'AISHE Institution Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2027-06-30', 'DEMO_INSTITUTION_ATTESTATION', 1.0, 'INST-AISHE-U-0212');
  insertEvidence.run('ev_arjun_benefit', 'student_arjun', 'Existing Benefit', 'existing_scholarship_benefit', '0', 'NSP Deduplication Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2027-03-31', 'DEMO_CROSS_SCHEME_CHECK', 0.99, 'DEDUP-NSP-20841');

  // Lakshmi Evidence (Assisted Access via CSC, tracking SETU-48291)
  insertEvidence.run('ev_lakshmi_identity', 'student_lakshmi', 'Identity', 'student_identity', 'Lakshmi Hembram (DOB: 2009-11-03)', 'CSC Assisted Verification (Demo)', 'SIMULATED_CSC_ADAPTER', 'VERIFIED', now, '2030-12-31', 'DEMO_ASSISTED_KYC', 0.98, 'DEMO-ID-JH-3003');
  insertEvidence.run('ev_lakshmi_st', 'student_lakshmi', 'ST Status', 'st_status', 'VERIFIED', 'State Caste Certificate Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2035-12-31', 'DEMO_CERTIFICATE_SIGNATURE', 0.99, 'CERT-ST-JH-48291');
  insertEvidence.run('ev_lakshmi_income', 'student_lakshmi', 'Income', 'annual_income', '145000', 'State e-District Income Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2027-03-31', 'DEMO_CERTIFICATE_VERIFY', 0.97, 'CERT-INC-JH-48291');
  insertEvidence.run('ev_lakshmi_academic', 'student_lakshmi', 'Academic', 'academic_category', 'POST_MATRIC', 'State Education Portal Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2027-05-31', 'DEMO_ENROLLMENT_CHECK', 0.98, 'ACA-JH-XI-48291');
  insertEvidence.run('ev_lakshmi_inst', 'student_lakshmi', 'Institution', 'institution_verified', '1', 'UDISE+ Institution Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2027-05-31', 'DEMO_INSTITUTION_ATTESTATION', 1.0, 'INST-UDISE-202109');
  insertEvidence.run('ev_lakshmi_benefit', 'student_lakshmi', 'Existing Benefit', 'existing_scholarship_benefit', '0', 'NSP Deduplication Adapter (Demo)', 'SIMULATED_GOV_ADAPTER', 'VERIFIED', now, '2027-03-31', 'DEMO_CROSS_SCHEME_CHECK', 0.99, 'DEDUP-NSP-48291');

  // 7. Seed Consent Record for Lakshmi (Assisted Access)
  db.prepare(`
    INSERT INTO consent_records (id, student_id, tracking_reference, assistance_point, operator_id, consent_scope, consent_status, granted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'consent_lakshmi_48291',
    'student_lakshmi',
    'SETU-48291',
    'Gram Panchayat CSC / Assistance Point — Khunti (#019)',
    'CSC-OP-JH-409',
    'Retrieve demo evidence certificates, evaluate Post-Matric eligibility, and generate portable tracking reference SETU-48291.',
    'ACTIVE',
    now
  );

  // 8. Seed Eligibility Evaluations & Rule Results
  const insertEval = db.prepare(`
    INSERT INTO eligibility_evaluations (evaluation_id, student_id, scheme_id, rule_set_version, result, summary_reason, next_action, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRuleRes = db.prepare(`
    INSERT INTO rule_results (id, evaluation_id, rule_id, expected, actual, evidence_id, status, reason, next_action)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Meena Evaluation -> CONDITIONS SATISFIED
  insertEval.run(
    'eval_meena_init',
    'student_meena',
    'SCH_PRE_MATRIC',
    'PRE_MATRIC_DEMO v0.1',
    'CONDITIONS SATISFIED',
    'All 4 Pre-Matric prototype rules passed with verified evidence and zero conflicts.',
    'Application moves forward automatically via straight-through processing.',
    now
  );
  insertRuleRes.run('rr_meena_1', 'eval_meena_init', 'RULE_ST_STATUS', '== VERIFIED', 'VERIFIED', 'ev_meena_st', 'SATISFIED', 'ST Certificate CERT-ST-JH-10492 is verified.', 'None');
  insertRuleRes.run('rr_meena_2', 'eval_meena_init', 'RULE_INCOME', '<= 250000', '120000', 'ev_meena_income', 'SATISFIED', 'Verified annual income ₹1,20,000 is within the ₹2,50,000 prototype threshold.', 'None');
  insertRuleRes.run('rr_meena_3', 'eval_meena_init', 'RULE_ACADEMIC_LEVEL', '== PRE_MATRIC', 'PRE_MATRIC', 'ev_meena_academic', 'SATISFIED', 'Enrolled in Class 9 at Govt. High School, Kanke.', 'None');
  insertRuleRes.run('rr_meena_4', 'eval_meena_init', 'RULE_NO_OVERLAP', '== 0', '0', 'ev_meena_benefit', 'SATISFIED', 'No overlapping central/state scholarship found.', 'None');

  // Arjun Evaluation -> REVIEW REQUIRED (because ₹2,40,000 != ₹2,80,000 straddling ₹2,50,000)
  insertEval.run(
    'eval_arjun_init',
    'student_arjun',
    'SCH_POST_MATRIC',
    'POST_MATRIC_DEMO v0.1',
    'REVIEW REQUIRED',
    'Income mismatch detected: Profile-declared income (₹2,40,000) passes <= ₹2,50,000, while Income Certificate (₹2,80,000) exceeds ₹2,50,000.',
    'Assigned to Scholarship Officer (Rajesh Kumar) to resolve INCOME_CONFLICT and re-evaluate.',
    now
  );
  insertRuleRes.run('rr_arjun_1', 'eval_arjun_init', 'RULE_ST_STATUS', '== VERIFIED', 'VERIFIED', 'ev_arjun_st', 'SATISFIED', 'ST Certificate CERT-ST-JH-20841 is verified.', 'None');
  insertRuleRes.run('rr_arjun_2', 'eval_arjun_init', 'RULE_INCOME', '<= 250000', 'CONFLICT (240000 vs 280000)', 'ev_arjun_income_cert', 'REVIEW REQUIRED', 'Profile income ₹2,40,000 is <= ₹2,50,000, but certificate income ₹2,80,000 is > ₹2,50,000.', 'Officer must verify authoritative income document and resolve conflict.');
  insertRuleRes.run('rr_arjun_3', 'eval_arjun_init', 'RULE_INSTITUTION', '== 1', '1', 'ev_arjun_inst', 'SATISFIED', 'Ranchi University institution record verified.', 'None');
  insertRuleRes.run('rr_arjun_4', 'eval_arjun_init', 'RULE_NO_OVERLAP', '== 0', '0', 'ev_arjun_benefit', 'SATISFIED', 'No duplicate active scholarship benefit.', 'None');

  // Lakshmi Evaluation -> CONDITIONS SATISFIED
  insertEval.run(
    'eval_lakshmi_init',
    'student_lakshmi',
    'SCH_POST_MATRIC',
    'POST_MATRIC_DEMO v0.1',
    'CONDITIONS SATISFIED',
    'All Post-Matric prototype rules satisfied via CSC Assisted Access (Tracking Ref: SETU-48291).',
    'Track application progress via portable reference SETU-48291.',
    now
  );

  // 9. Seed Conflict & Exception for Arjun
  db.prepare(`
    INSERT INTO conflicts (id, student_id, type, severity, evidence_ids, affected_rule, owner, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'conf_arjun_income',
    'student_arjun',
    'INCOME_CONFLICT',
    'HIGH',
    JSON.stringify(['ev_arjun_income_profile', 'ev_arjun_income_cert']),
    'RULE_INCOME',
    'Scholarship Officer',
    'OPEN',
    '2026-09-28T10:42:00Z'
  );

  db.prepare(`
    INSERT INTO exceptions (
      id, conflict_id, student_id, scheme_id, type, problem_summary,
      evidence_a_id, evidence_b_id, affected_rule, rule_version,
      owner, assigned_officer_id, case_age, recommended_action, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'exc_arjun_income',
    'conf_arjun_income',
    'student_arjun',
    'SCH_POST_MATRIC',
    'INCOME_CONFLICT',
    'Profile-declared annual income (₹2,40,000) conflicts with State e-District Income Certificate (₹2,80,000) across the ₹2,50,000 Post-Matric threshold.',
    'ev_arjun_income_profile',
    'ev_arjun_income_cert',
    'RULE_INCOME',
    'POST_MATRIC_DEMO v0.1',
    'Scholarship Officer',
    'user_rajesh',
    '2 hrs',
    'Compare Student Profile Declaration (₹2,40,000) and State Income Certificate (₹2,80,000). Confirm authoritative value to trigger deterministic re-evaluation.',
    'OPEN',
    '2026-09-28T10:42:00Z',
    '2026-09-28T10:43:00Z'
  );

  // 10. Seed Applications
  const insertApp = db.prepare(`
    INSERT INTO applications (
      id, student_id, scheme_id, tracking_reference, current_stage, status,
      where_is_it, why_here, owner, next_action, submitted_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertApp.run(
    'app_meena',
    'student_meena',
    'SCH_PRE_MATRIC',
    'SETU-10492',
    'DBT_INITIATED',
    'CONDITIONS SATISFIED',
    'PFMS / Tribal Welfare DBT Disbursement Gateway (Demo)',
    'All evidence verified automatically; Pre-Matric sanction approved via straight-through processing.',
    'DBT Payment Gateway (Simulated)',
    'No student action required. Direct Benefit Transfer initiated.',
    now,
    now
  );

  insertApp.run(
    'app_arjun',
    'student_arjun',
    'SCH_POST_MATRIC',
    'SETU-20841',
    'EVIDENCE_VERIFIED',
    'REVIEW REQUIRED',
    'District Scholarship Officer Exception Queue (Rajesh Kumar)',
    'Income mismatch detected between profile declaration (₹2,40,000) and certificate (₹2,80,000) across the ₹2,50,000 Post-Matric limit.',
    'Scholarship Officer (Rajesh Kumar)',
    'Awaiting Officer resolution of INCOME_CONFLICT (or upload updated income certificate if applicable).',
    now,
    now
  );

  insertApp.run(
    'app_lakshmi',
    'student_lakshmi',
    'SCH_POST_MATRIC',
    'SETU-48291',
    'INSTITUTION_VERIFIED',
    'CONDITIONS SATISFIED',
    'District Scheme Verification Desk (Assisted Access Ref: SETU-48291)',
    'Submitted at CSC Assistance Point Khunti with student consent; evidence and institution verified.',
    'Scheme Verification Desk',
    'Keep tracking token SETU-48291 for status lookup at any CSC or mobile browser.',
    now,
    now
  );

  // 11. Seed Payments (DEMO DATA)
  const insertPayment = db.prepare(`
    INSERT INTO payments (
      id, student_id, application_id, scheme, academic_year, sanction_status,
      payment_status, amount, payment_date, source, last_updated, freshness
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPayment.run(
    'pay_meena',
    'student_meena',
    'app_meena',
    'Pre-Matric',
    '2026-27',
    'SANCTIONED',
    'DBT Initiated',
    4500,
    '2026-09-28',
    'DEMO DATA — Simulated PFMS Adapter',
    '2026-09-28 10:30 IST',
    'AUTHORITATIVE_SIMULATED'
  );

  insertPayment.run(
    'pay_arjun',
    'student_arjun',
    'app_arjun',
    'Post-Matric',
    '2026-27',
    'PENDING_RESOLUTION',
    'Awaiting Eligibility Clearance',
    18000,
    'Pending',
    'DEMO DATA — Simulated PFMS Adapter',
    '2026-09-28 10:43 IST',
    'AUTHORITATIVE_SIMULATED'
  );

  insertPayment.run(
    'pay_lakshmi',
    'student_lakshmi',
    'app_lakshmi',
    'Post-Matric',
    '2026-27',
    'IN_PROGRESS',
    'Pending Sanction Order',
    18000,
    'Scheduled',
    'DEMO DATA — Simulated PFMS Adapter',
    '2026-09-28 10:35 IST',
    'AUTHORITATIVE_SIMULATED'
  );

  // 12. Seed Notifications
  const insertNotif = db.prepare(`
    INSERT INTO notifications (id, student_id, event_type, title, message, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertNotif.run('notif_meena_1', 'student_meena', 'VERIFICATION_COMPLETED', 'All Evidence Verified', 'Your Identity, ST Status, Income (₹1,20,000), and Class 9 enrollment have been verified.', 0, '2026-09-28T10:31:00Z');
  insertNotif.run('notif_meena_2', 'student_meena', 'DBT_INITIATED', 'Sanctioned & DBT Initiated (Demo)', 'Your Pre-Matric Scholarship (₹4,500) is sanctioned and queued for DBT.', 0, '2026-09-28T10:35:00Z');

  insertNotif.run('notif_arjun_1', 'student_arjun', 'EXCEPTION_CREATED', 'Action/Review Required: Income Data Conflict', 'SetuOne detected a mismatch between your profile income (₹2,40,000) and e-District income certificate (₹2,80,000). Your case is assigned to Scholarship Officer Rajesh Kumar (not rejected).', 0, '2026-09-28T10:43:00Z');

  insertNotif.run('notif_lakshmi_1', 'student_lakshmi', 'APPLICATION_SUBMITTED', 'Assisted Application Saved (SETU-48291)', 'Your Post-Matric application was recorded at CSC Khunti (#019) with consent. Reference: SETU-48291.', 0, '2026-09-28T10:32:00Z');

  // 13. Seed Baseline Audit Logs (Matching Section 26 & Section 38)
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, timestamp, actor, action, entity, entity_id, before_state, after_state, rule_version, evidence_reference)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAudit.run(
    'audit_arjun_1',
    '10:42',
    'SYSTEM',
    'Income mismatch detected',
    'conflict',
    'student_arjun',
    'EVIDENCE_CHECK_STARTED',
    'INCOME_CONFLICT (₹2,40,000 profile vs ₹2,80,000 certificate)',
    'POST_MATRIC_DEMO v0.1',
    'ev_arjun_income_profile, ev_arjun_income_cert'
  );

  insertAudit.run(
    'audit_arjun_2',
    '10:43',
    'SYSTEM',
    'Case assigned to Scholarship Officer',
    'exception',
    'student_arjun',
    'OPEN',
    'ASSIGNED (Rajesh Kumar)',
    'POST_MATRIC_DEMO v0.1',
    'exc_arjun_income'
  );

  insertAudit.run(
    'audit_meena_1',
    '10:30',
    'SYSTEM',
    'Straight-through eligibility satisfied',
    'evaluation',
    'student_meena',
    'ELIGIBILITY_CHECKED',
    'CONDITIONS SATISFIED',
    'PRE_MATRIC_DEMO v0.1',
    'ev_meena_income'
  );

  insertAudit.run(
    'audit_lakshmi_1',
    '10:32',
    'CSC-OP-JH-409',
    'Assisted access consent recorded (SETU-48291)',
    'consent',
    'student_lakshmi',
    'UNREGISTERED',
    'CONSENT_ACTIVE (SETU-48291)',
    'POST_MATRIC_DEMO v0.1',
    'consent_lakshmi_48291'
  );

  // 14. Seed Integration Sources (8 Mock Adapters from Section 23)
  const insertAdapter = db.prepare(`
    INSERT INTO integration_sources (id, adapter_name, display_name, status, simulated_outcome, last_checked)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const adapters = [
    ['adp_nsp', 'NSPAdapter', 'National Scholarship Portal Adapter (Simulated)', 'OPERATIONAL', 'VERIFIED'],
    ['adp_fellowship', 'FellowshipAdapter', 'Fellowship / SFMP Adapter (Simulated)', 'OPERATIONAL', 'VERIFIED'],
    ['adp_nos', 'NOSAdapter', 'National Overseas Scholarship Adapter (Simulated)', 'OPERATIONAL', 'VERIFIED'],
    ['adp_digilocker', 'DigiLockerAdapter', 'Document Locker Adapter (Simulated)', 'OPERATIONAL', 'VERIFIED'],
    ['adp_education', 'EducationAdapter', 'UDISE+ / AISHE Education Adapter (Simulated)', 'OPERATIONAL', 'VERIFIED'],
    ['adp_certificate', 'CertificateAdapter', 'State e-District Certificate Adapter (Simulated)', 'OPERATIONAL', 'VERIFIED'],
    ['adp_identity', 'IdentityAdapter', 'Demographic Identity Adapter (Simulated)', 'OPERATIONAL', 'VERIFIED'],
    ['adp_payment', 'PaymentAdapter', 'PFMS / DBT Payment Adapter (Simulated)', 'OPERATIONAL', 'VERIFIED'],
  ];

  for (const [id, name, display, status, outcome] of adapters) {
    insertAdapter.run(id, name, display, status, outcome, now);
  }

  // 15. Seed Ministry Coverage Intelligence Candidates (Section 30 — strictly "Potential Coverage Gap")
  const insertOutreach = db.prepare(`
    INSERT INTO outreach_candidates (
      id, district, state, education_level, enrolled_st_count,
      matched_scholarship_count, potential_coverage_gap, screening_status, classification_label, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertOutreach.run('out_khunti', 'Khunti', 'Jharkhand', 'Classes 9–12', 14200, 11350, 2850, 'SCREENING_REQUIRED', 'Potential Coverage Gap', now);
  insertOutreach.run('out_ranchi', 'Ranchi', 'Jharkhand', 'Undergraduate (Post-Matric)', 28400, 24900, 3500, 'TARGETED_OUTREACH_QUEUED', 'Potential Coverage Gap', now);
  insertOutreach.run('out_gumla', 'Gumla', 'Jharkhand', 'Classes 9–10 (Pre-Matric)', 16800, 12900, 3900, 'SCREENING_REQUIRED', 'Potential Coverage Gap', now);
}

export function resetDemoDatabase(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = OFF;');
  for (const table of [...CORE_TABLES].reverse()) {
    db.exec(`DROP TABLE IF EXISTS ${table};`);
  }
  db.exec('PRAGMA foreign_keys = ON;');
  seedDatabase(db);
}
