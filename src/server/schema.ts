import { DatabaseSync } from 'node:sqlite';

export const CORE_TABLES = [
  'users',
  'students',
  'guardians',
  'guardian_student_links',
  'student_profiles',
  'schemes',
  'scheme_rule_versions',
  'scheme_rules',
  'evidence',
  'verification_results',
  'applications',
  'application_events',
  'eligibility_evaluations',
  'rule_results',
  'conflicts',
  'exceptions',
  'resolutions',
  'payments',
  'notifications',
  'audit_logs',
  'consent_records',
  'integration_sources',
  'retry_jobs',
  'outreach_candidates',
] as const;

export function createTables(db: DatabaseSync): void {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('student', 'guardian', 'officer', 'ministry')),
      mobile TEXT NOT NULL,
      demo_id TEXT UNIQUE NOT NULL,
      auth_method_label TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS students (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      scenario_tag TEXT NOT NULL,
      target_scheme_id TEXT NOT NULL,
      tracking_reference TEXT UNIQUE NOT NULL,
      assisted_access INTEGER NOT NULL DEFAULT 0,
      csc_centre_id TEXT,
      profile_completeness INTEGER NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS guardians (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      relationship TEXT NOT NULL,
      district TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS guardian_student_links (
      id TEXT PRIMARY KEY,
      guardian_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      relationship TEXT NOT NULL,
      linked_at TEXT NOT NULL,
      UNIQUE(guardian_id, student_id),
      FOREIGN KEY (guardian_id) REFERENCES guardians(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS student_profiles (
      id TEXT PRIMARY KEY,
      student_id TEXT UNIQUE NOT NULL,
      state TEXT NOT NULL,
      district TEXT NOT NULL,
      community_category TEXT NOT NULL,
      st_tribe_name TEXT NOT NULL,
      st_status TEXT NOT NULL,
      annual_income INTEGER NOT NULL,
      academic_level TEXT NOT NULL,
      academic_category TEXT NOT NULL,
      institution_name TEXT NOT NULL,
      institution_verified INTEGER NOT NULL DEFAULT 1,
      attendance_percentage REAL NOT NULL,
      previous_marks_percentage REAL NOT NULL,
      existing_scholarship_benefit INTEGER NOT NULL DEFAULT 0,
      identity_status TEXT NOT NULL DEFAULT 'MATCHED',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS schemes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      benefit_summary TEXT NOT NULL,
      active_rule_version TEXT NOT NULL,
      validation_status TEXT NOT NULL,
      badge_text TEXT NOT NULL,
      income_threshold INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scheme_rule_versions (
      id TEXT PRIMARY KEY,
      scheme_id TEXT NOT NULL,
      rule_set_id TEXT NOT NULL,
      version TEXT NOT NULL,
      source_label TEXT NOT NULL,
      effective_date TEXT NOT NULL,
      validation_status TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      FOREIGN KEY (scheme_id) REFERENCES schemes(id)
    );

    CREATE TABLE IF NOT EXISTS scheme_rules (
      id TEXT PRIMARY KEY,
      rule_version_id TEXT NOT NULL,
      scheme_id TEXT NOT NULL,
      rule_code TEXT NOT NULL,
      field TEXT NOT NULL,
      operator TEXT NOT NULL,
      expected_value TEXT NOT NULL,
      description TEXT NOT NULL,
      FOREIGN KEY (rule_version_id) REFERENCES scheme_rule_versions(id),
      FOREIGN KEY (scheme_id) REFERENCES schemes(id)
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      category TEXT NOT NULL,
      claim_type TEXT NOT NULL,
      claim_value TEXT NOT NULL,
      source TEXT NOT NULL,
      source_type TEXT NOT NULL,
      verification_status TEXT NOT NULL CHECK (verification_status IN ('VERIFIED', 'PENDING', 'CONFLICT', 'EXPIRED', 'UNAVAILABLE')),
      retrieved_at TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      verification_method TEXT NOT NULL,
      confidence REAL NOT NULL,
      document_reference TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS verification_results (
      id TEXT PRIMARY KEY,
      evidence_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      adapter_name TEXT NOT NULL,
      outcome TEXT NOT NULL,
      details TEXT NOT NULL,
      verified_at TEXT NOT NULL,
      FOREIGN KEY (evidence_id) REFERENCES evidence(id),
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      scheme_id TEXT NOT NULL,
      tracking_reference TEXT NOT NULL,
      current_stage TEXT NOT NULL,
      status TEXT NOT NULL,
      where_is_it TEXT NOT NULL,
      why_here TEXT NOT NULL,
      owner TEXT NOT NULL,
      next_action TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (scheme_id) REFERENCES schemes(id)
    );

    CREATE TABLE IF NOT EXISTS application_events (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      where_is_it TEXT NOT NULL,
      why_here TEXT NOT NULL,
      owner TEXT NOT NULL,
      next_action TEXT NOT NULL,
      status TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );

    CREATE TABLE IF NOT EXISTS eligibility_evaluations (
      evaluation_id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      scheme_id TEXT NOT NULL,
      rule_set_version TEXT NOT NULL,
      result TEXT NOT NULL CHECK (result IN ('CONDITIONS SATISFIED', 'REVIEW REQUIRED', 'CONDITION NOT SATISFIED')),
      summary_reason TEXT NOT NULL,
      next_action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (scheme_id) REFERENCES schemes(id)
    );

    CREATE TABLE IF NOT EXISTS rule_results (
      id TEXT PRIMARY KEY,
      evaluation_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      expected TEXT NOT NULL,
      actual TEXT NOT NULL,
      evidence_id TEXT NOT NULL,
      status TEXT NOT NULL,
      reason TEXT NOT NULL,
      next_action TEXT NOT NULL,
      FOREIGN KEY (evaluation_id) REFERENCES eligibility_evaluations(evaluation_id)
    );

    CREATE TABLE IF NOT EXISTS conflicts (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      evidence_ids TEXT NOT NULL,
      affected_rule TEXT NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS exceptions (
      id TEXT PRIMARY KEY,
      conflict_id TEXT NOT NULL,
      student_id TEXT NOT NULL,
      scheme_id TEXT NOT NULL,
      type TEXT NOT NULL,
      problem_summary TEXT NOT NULL,
      evidence_a_id TEXT NOT NULL,
      evidence_b_id TEXT NOT NULL,
      affected_rule TEXT NOT NULL,
      rule_version TEXT NOT NULL,
      owner TEXT NOT NULL,
      assigned_officer_id TEXT NOT NULL,
      case_age TEXT NOT NULL,
      recommended_action TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('OPEN', 'ASSIGNED', 'IN_REVIEW', 'RESOLVED', 'ESCALATED', 'RE_EVALUATING', 'CLOSED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (conflict_id) REFERENCES conflicts(id),
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (scheme_id) REFERENCES schemes(id)
    );

    CREATE TABLE IF NOT EXISTS resolutions (
      id TEXT PRIMARY KEY,
      exception_id TEXT NOT NULL,
      officer_id TEXT NOT NULL,
      accepted_source TEXT NOT NULL,
      accepted_value TEXT NOT NULL,
      resolution_notes TEXT NOT NULL,
      new_evaluation_id TEXT NOT NULL,
      new_result TEXT NOT NULL,
      resolved_at TEXT NOT NULL,
      FOREIGN KEY (exception_id) REFERENCES exceptions(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      scheme TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      sanction_status TEXT NOT NULL,
      payment_status TEXT NOT NULL,
      amount INTEGER NOT NULL,
      payment_date TEXT NOT NULL,
      source TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      freshness TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      before_state TEXT NOT NULL,
      after_state TEXT NOT NULL,
      rule_version TEXT NOT NULL,
      evidence_reference TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS consent_records (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      tracking_reference TEXT NOT NULL,
      assistance_point TEXT NOT NULL,
      operator_id TEXT NOT NULL,
      consent_scope TEXT NOT NULL,
      consent_status TEXT NOT NULL,
      granted_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS integration_sources (
      id TEXT PRIMARY KEY,
      adapter_name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('OPERATIONAL', 'SERVICE_UNAVAILABLE')),
      simulated_outcome TEXT NOT NULL,
      last_checked TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS retry_jobs (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      service_name TEXT NOT NULL,
      status TEXT NOT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 1,
      last_known_state TEXT NOT NULL,
      next_retry_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (student_id) REFERENCES students(id)
    );

    CREATE TABLE IF NOT EXISTS outreach_candidates (
      id TEXT PRIMARY KEY,
      district TEXT NOT NULL,
      state TEXT NOT NULL,
      education_level TEXT NOT NULL,
      enrolled_st_count INTEGER NOT NULL,
      matched_scholarship_count INTEGER NOT NULL,
      potential_coverage_gap INTEGER NOT NULL,
      screening_status TEXT NOT NULL,
      classification_label TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}
