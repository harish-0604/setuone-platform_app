export type UserRole = 'student' | 'guardian' | 'officer';

export interface DemoSession {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  mobile: string;
  demoId: string;
  authMethodLabel: string;
  studentId: string | null;
  guardianId: string | null;
  trackingReference: string | null;
  simulated: boolean;
  sessionType: string;
  disclaimer: string;
}

export interface SchemeRuleItem {
  id: string;
  rule_code: string;
  field: string;
  operator: string;
  expected_value: string;
  description: string;
}

export interface SchemeItem {
  id: string;
  name: string;
  code: string;
  description: string;
  benefit_summary: string;
  active_rule_version: string;
  validation_status: string;
  badge_text: string;
  income_threshold: number;
  rules?: SchemeRuleItem[];
}

export interface EvidenceItem {
  id: string;
  student_id: string;
  category: string;
  claim_type: string;
  claim_value: string;
  source: string;
  source_type: string;
  verification_status: 'VERIFIED' | 'PENDING' | 'CONFLICT' | 'EXPIRED' | 'UNAVAILABLE';
  retrieved_at: string;
  valid_until: string;
  verification_method: string;
  confidence: number;
  document_reference: string;
}
