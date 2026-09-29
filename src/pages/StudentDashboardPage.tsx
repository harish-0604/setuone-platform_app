import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  FileText,
  Shield,
  Clock,
  CreditCard,
  Bell,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { PortalLayout } from '../layouts/PortalLayout.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { EvidenceItem, SchemeItem } from '../types/index.ts';

const APPLICATION_STAGES = [
  { code: 'PROFILE_CREATED', label: 'Profile Created' },
  { code: 'ELIGIBILITY_CHECKED', label: 'Eligibility Checked' },
  { code: 'APPLICATION_SUBMITTED', label: 'Application Submitted' },
  { code: 'EVIDENCE_VERIFIED', label: 'Evidence Verified' },
  { code: 'INSTITUTION_VERIFIED', label: 'Institution Verified' },
  { code: 'SCHEME_VERIFIED', label: 'Scheme Verified' },
  { code: 'SANCTIONED', label: 'Sanctioned' },
  { code: 'DBT_INITIATED', label: 'DBT Initiated' },
  { code: 'PAID', label: 'Paid' },
];

const RESOLUTION_STEPS = ['Detect', 'Explain', 'Assign', 'Resolve', 'Re-evaluate', 'Continue'];

interface RuleResultRow {
  id: string;
  rule_id: string;
  expected: string;
  actual: string;
  evidence_id: string;
  status: string;
  reason: string;
  next_action: string;
}

interface EvaluationRecord {
  evaluation_id: string;
  student_id: string;
  scheme_id: string;
  scheme_name?: string;
  income_threshold?: number;
  rule_set_version: string;
  result: 'CONDITIONS SATISFIED' | 'REVIEW REQUIRED' | 'CONDITION NOT SATISFIED';
  summary_reason: string;
  next_action: string;
  created_at: string;
  rule_results?: RuleResultRow[];
}

interface StudentDashboardData {
  student: {
    id: string;
    full_name: string;
    scenario_tag: string;
    target_scheme_id: string;
    tracking_reference: string;
    assisted_access: number;
    csc_centre_id: string | null;
    profile_completeness: number;
  };
  profile: {
    state: string;
    district: string;
    community_category: string;
    st_tribe_name: string;
    st_status: string;
    annual_income: number;
    academic_level: string;
    academic_category: string;
    institution_name: string;
  };
  scheme: SchemeItem;
  application: {
    id: string;
    scheme_id: string;
    tracking_reference: string;
    current_stage: string;
    status: string;
    where_is_it: string;
    why_here: string;
    owner: string;
    next_action: string;
    updated_at: string;
  };
  evaluation: EvaluationRecord | null;
  evidence: EvidenceItem[];
  payments: Array<{
    id: string;
    scheme: string;
    academic_year: string;
    sanction_status: string;
    payment_status: string;
    amount: number;
    payment_date: string;
    source: string;
    last_updated: string;
    freshness: string;
  }>;
  notifications: Array<{
    id: string;
    event_type: string;
    title: string;
    message: string;
    created_at: string;
  }>;
  exceptions: Array<{
    id: string;
    type: string;
    problem_summary: string;
    evidence_a_id: string;
    evidence_b_id: string;
    affected_rule: string;
    rule_version: string;
    owner: string;
    status: string;
    recommended_action: string;
  }>;
  consent: {
    id: string;
    tracking_reference: string;
    assistance_point: string;
    operator_id: string;
    consent_scope: string;
    consent_status: string;
    granted_at: string;
  } | null;
  retryJobs: Array<{
    id: string;
    service_name: string;
    status: string;
    last_known_state: string;
    next_retry_at: string;
  }>;
  adapters?: Array<{
    id: string;
    adapter_name: string;
    display_name: string;
    status: string;
    simulated_outcome: string;
    last_checked: string;
  }>;
  outageActive: boolean;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

function formatClaimValue(claimType: string, value: string): string {
  if (claimType === 'annual_income' && !Number.isNaN(Number(value))) {
    return `₹${Number(value).toLocaleString('en-IN')}`;
  }
  if (claimType === 'institution_verified') {
    return value === '1' ? 'VERIFIED (Recognized Institution)' : 'UNVERIFIED';
  }
  if (claimType === 'existing_scholarship_benefit') {
    return value === '0' ? 'None (No Active Overlap)' : `Active Benefit (${value})`;
  }
  return value;
}

function getEvidenceBadgeStyle(status: EvidenceItem['verification_status']): string {
  switch (status) {
    case 'VERIFIED':
      return 'bg-teal-50 text-teal-800 border-teal-200';
    case 'PENDING':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'CONFLICT':
      return 'bg-red-50 text-red-800 border-red-200';
    case 'EXPIRED':
      return 'bg-amber-50 text-slate-700 border-amber-200';
    case 'UNAVAILABLE':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

function getResultBadgeStyle(result: string): string {
  if (result === 'CONDITIONS SATISFIED') {
    return 'bg-teal-50 text-teal-800 border-teal-300';
  }
  if (result === 'REVIEW REQUIRED') {
    return 'bg-amber-100 text-amber-900 border-amber-300';
  }
  return 'bg-red-50 text-red-800 border-red-200';
}

export const StudentDashboardPage: React.FC = () => {
  const { session, getAuthHeaders, loginWithSimulatedCredentials } = useAuth();
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [schemes, setSchemes] = useState<SchemeItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<
    'home' | 'eligibility' | 'passport' | 'journey' | 'payments' | 'notifications' | 'jago'
  >('home');

  // Eligibility check state
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>('');
  const [evalResult, setEvalResult] = useState<EvaluationRecord | null>(null);
  const [schemeComparisons, setSchemeComparisons] = useState<EvaluationRecord[]>([]);
  const [checkingEligibility, setCheckingEligibility] = useState<boolean>(false);

  // Evidence Passport adapter verification state
  const [verifyingPassport, setVerifyingPassport] = useState<boolean>(false);
  const [passportVerifyMessage, setPassportVerifyMessage] = useState<string | null>(null);

  // JAGO deterministic question state
  const [jagoQuery, setJagoQuery] = useState<string>('');
  const [jagoHistory, setJagoHistory] = useState<Array<{ q: string; a: string }>>([]);

  const fetchDashboard = useCallback(async () => {
    if (!session?.studentId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [dashRes, schemesRes] = await Promise.all([
        fetch(`/api/students/${session.studentId}/dashboard`, { headers: getAuthHeaders() }),
        fetch('/api/schemes', { headers: getAuthHeaders() }),
      ]);
      const dashBody = await dashRes.json();
      const schemesBody = await schemesRes.json();

      if (!dashRes.ok) {
        throw new Error(dashBody.message || dashBody.error || 'Failed to load student dashboard');
      }

      setData(dashBody as StudentDashboardData);
      setSchemes((schemesBody.schemes || []) as SchemeItem[]);
      if (!selectedSchemeId && dashBody.student?.target_scheme_id) {
        setSelectedSchemeId(dashBody.student.target_scheme_id);
      }
      if (dashBody.evaluation) {
        setEvalResult(dashBody.evaluation as EvaluationRecord);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading student record');
    } finally {
      setLoading(false);
    }
  }, [session?.studentId, getAuthHeaders, selectedSchemeId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleRunEligibilityCheck = async (overrideSchemeId?: string) => {
    if (!session?.studentId) return;
    const targetScheme = overrideSchemeId || selectedSchemeId || data?.student?.target_scheme_id || 'SCH_PRE_MATRIC';
    setSelectedSchemeId(targetScheme);
    setCheckingEligibility(true);
    try {
      const res = await fetch('/api/eligibility/check', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          student_id: session.studentId,
          scheme_id: targetScheme,
        }),
      });
      const body = await res.json();
      if (res.ok && body.evaluation) {
        setEvalResult(body.evaluation as EvaluationRecord);
        setActiveTab('eligibility');
      }
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleCompareAllSchemes = async () => {
    if (!session?.studentId) return;
    setCheckingEligibility(true);
    try {
      const res = await fetch('/api/eligibility/check-all', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ student_id: session.studentId }),
      });
      const body = await res.json();
      if (res.ok && body.comparisons) {
        setSchemeComparisons(body.comparisons as EvaluationRecord[]);
      }
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleVerifyEvidencePassport = async () => {
    if (!session?.studentId) return;
    setVerifyingPassport(true);
    setPassportVerifyMessage(null);
    try {
      const res = await fetch(`/api/students/${session.studentId}/evidence/verify`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const body = await res.json();
      if (res.ok) {
        setPassportVerifyMessage(body.message);
        await fetchDashboard();
      }
    } finally {
      setVerifyingPassport(false);
    }
  };

  const answerJagoDeterministic = (question: string): string => {
    if (!data) {
      return 'I cannot confirm that from the available information. Please use the official assistance or review route.';
    }
    const q = question.trim().toLowerCase();
    const openExc = data.exceptions.find((e) => e.status !== 'RESOLVED' && e.status !== 'CLOSED');
    const conflictEvs = data.evidence.filter((e) => e.verification_status === 'CONFLICT');
    const missingEvs = data.evidence.filter(
      (e) => e.verification_status === 'PENDING' || e.verification_status === 'UNAVAILABLE' || e.verification_status === 'EXPIRED'
    );
    const payment = data.payments[0];

    if (q.includes('application status') || q === 'what is my application status?') {
      return `Current Application Status: ${data.application.status} (Stage: ${data.application.current_stage}). Location: ${data.application.where_is_it}. Reason: ${data.application.why_here}`;
    }
    if (q.includes('document is missing') || q.includes('missing') || q === 'what document is missing?') {
      if (conflictEvs.length > 0) {
        return `No document is missing, custom conflict detected: ${conflictEvs.map((e) => `${e.category} (${formatClaimValue(e.claim_type, e.claim_value)} from ${e.source})`).join(' vs ')}. Status: REVIEW REQUIRED.`;
      }
      if (missingEvs.length === 0) {
        return `All ${data.evidence.length} structured evidence items in your Evidence Passport are currently VERIFIED. No document is missing.`;
      }
      return `Pending/Unavailable documents: ${missingEvs.map((e) => `${e.category} (${e.verification_status})`).join(', ')}.`;
    }
    if (q.includes('do next') || q.includes('next action') || q === 'what should i do next?') {
      if (openExc) {
        return `Next Action: ${data.application.next_action} Your case (${openExc.type}) is assigned to ${openExc.owner} and is NOT rejected.`;
      }
      return `Next Action: ${data.application.next_action}`;
    }
    if (q.includes('payment status') || q.includes('dbt') || q === 'what is my payment status?') {
      if (!payment) {
        return 'No payment record is currently available in the system.';
      }
      return `Payment Status (DEMO DATA): ${payment.payment_status} • Sanction Status: ${payment.sanction_status} • Amount: ₹${payment.amount.toLocaleString('en-IN')} (${payment.scheme}, AY ${payment.academic_year}). Last Updated: ${payment.last_updated}. Source: ${payment.source}.`;
    }
    if (q.includes('scholarship require') || q.includes('require') || q === 'what does this scholarship require?') {
      return `${data.scheme.name} (${data.scheme.active_rule_version} — DEMO RULE — NOT AUTHORITATIVE) requires: Verified ST certificate, annual family income <= ₹${Number(data.scheme.income_threshold).toLocaleString('en-IN')}, verified institution enrollment, and zero overlapping central/state scholarship benefit.`;
    }
    return 'I cannot confirm that from the available information. Please use the official assistance or review route.';
  };

  const handleAskJago = (questionText: string) => {
    if (!questionText.trim()) return;
    const reply = answerJagoDeterministic(questionText);
    setJagoHistory((prev) => [...prev, { q: questionText, a: reply }]);
    setJagoQuery('');
  };

  const navItems = [
    { id: 'home', label: 'Home', active: activeTab === 'home', onClick: () => setActiveTab('home') },
    { id: 'eligibility', label: 'Check Eligibility', active: activeTab === 'eligibility', onClick: () => setActiveTab('eligibility') },
    { id: 'passport', label: 'Evidence Passport', active: activeTab === 'passport', onClick: () => setActiveTab('passport') },
    { id: 'journey', label: 'Application Journey', active: activeTab === 'journey', onClick: () => setActiveTab('journey') },
    { id: 'payments', label: 'Payments', active: activeTab === 'payments', onClick: () => setActiveTab('payments') },
    {
      id: 'notifications',
      label: `Notifications${data?.notifications?.length ? ` (${data.notifications.length})` : ''}`,
      active: activeTab === 'notifications',
      onClick: () => setActiveTab('notifications'),
    },
    { id: 'jago', label: 'JAGO', active: activeTab === 'jago', onClick: () => setActiveTab('jago') },
  ];

  const openException = data?.exceptions?.find((e) => e.status !== 'RESOLVED' && e.status !== 'CLOSED');
  const evidenceA = openException
    ? data?.evidence?.find((e) => e.id === openException.evidence_a_id)
    : undefined;
  const evidenceB = openException
    ? data?.evidence?.find((e) => e.id === openException.evidence_b_id)
    : undefined;

  const verifiedEvidenceCount = data?.evidence?.filter((e) => e.verification_status === 'VERIFIED').length ?? 0;
  const conflictEvidenceCount = data?.evidence?.filter((e) => e.verification_status === 'CONFLICT').length ?? 0;
  const totalEvidenceCount = data?.evidence?.length ?? 0;
  const activePayment = data?.payments?.[0];
  const activeRetryJob = data?.retryJobs?.[0];

  const currentStageIndex = APPLICATION_STAGES.findIndex(
    (s) => s.code === (data?.application?.current_stage || 'PROFILE_CREATED')
  );

  const selectedSchemeObj =
    schemes.find((s) => s.id === (selectedSchemeId || data?.student?.target_scheme_id)) || data?.scheme;

  return (
    <PortalLayout portalLabel="Student" navItems={navItems}>
      <div className="space-y-5" data-testid="student-dashboard">
        {loading && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-xs text-slate-600 shadow-2xs">
            Loading student scholarship records from SQLite...
          </div>
        )}

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs text-red-800">
            {error}
          </div>
        )}

        {!loading && data && (
          <>
            {/* Student Demo Case Switcher Bar (Clean vs Income Conflict vs Assisted Access) */}
            <div
              data-testid="student-case-switcher"
              className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2">
                <span className="font-bold uppercase tracking-wide text-slate-500 text-[11px]">
                  Active Student Case:
                </span>
                <span className="font-semibold text-[#0f2942]">
                  {data.student.full_name} ({data.student.scenario_tag})
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  {
                    studentId: 'student_arjun',
                    identifier: '9876500002',
                    label: 'Sample 2 — Income Conflict (₹2.4L vs ₹2.8L)',
                  },
                  {
                    studentId: 'student_meena',
                    identifier: '9876500001',
                    label: 'Sample 1 — Clean Case (Straight-Through)',
                  },
                  {
                    studentId: 'student_lakshmi',
                    identifier: 'SETU-48291',
                    label: 'Sample 3 — Assisted Access (SETU-48291)',
                  },
                ].map((item) => {
                  const isCurrent = data.student.id === item.studentId;
                  return (
                    <button
                      key={item.studentId}
                      type="button"
                      data-testid={`switch-student-${item.studentId}`}
                      onClick={async () => {
                        setSelectedSchemeId('');
                        setSchemeComparisons([]);
                        await loginWithSimulatedCredentials({
                          role: 'student',
                          identifier: item.identifier,
                          otp: '123456',
                        });
                      }}
                      className={`px-2.5 py-1 rounded border text-[11px] font-semibold transition-colors cursor-pointer ${
                        isCurrent
                          ? 'bg-[#0f2942] text-white border-[#0f2942]'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-teal-700 hover:text-teal-900'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Student Identity Section */}
            <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left: Avatar + Name + ST Beneficiary Badge + Reference + Metadata */}
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-lg bg-[#0f2942] text-teal-300 font-bold text-base flex items-center justify-center shrink-0 border border-slate-700">
                    {getInitials(data.student.full_name)}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-lg font-bold text-[#0f2942] leading-none">
                        {data.student.full_name}
                      </h1>
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                        ST Beneficiary
                      </span>
                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        ID: {data.student.tracking_reference}
                      </span>
                      {data.student.assisted_access === 1 && (
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                          CSC Assisted Access ({data.student.csc_centre_id})
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-1 text-xs text-slate-600 pt-0.5">
                      <div>
                        <span className="text-slate-400 font-medium">Community: </span>
                        <span className="font-semibold text-slate-800">
                          {data.profile.community_category} ({data.profile.st_tribe_name})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Domicile: </span>
                        <span className="font-semibold text-slate-800">
                          {data.profile.district}, {data.profile.state}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Institution: </span>
                        <span className="font-semibold text-slate-800">
                          {data.profile.institution_name}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Compact Profile Completeness Card */}
                <div className="lg:w-56 bg-slate-50 border border-slate-200 rounded-md p-3 shrink-0">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-slate-600">Profile Completeness</span>
                    <span className="font-mono font-bold text-[#0f2942] tabular-nums">
                      {data.student.profile_completeness}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-700 rounded-full"
                      style={{ width: `${data.student.profile_completeness}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1.5 flex items-center justify-between">
                    <span>{data.profile.academic_level}</span>
                    <span className="font-mono text-teal-800 font-semibold">KYC Match</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Simulated API Outage / Queue Banner (Section 24, 34, 40) */}
            {(data.outageActive || activeRetryJob) && (
              <section
                data-testid="api-outage-banner"
                className="bg-amber-50 border border-amber-300 rounded-lg p-4 shadow-2xs space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
                    <RefreshCw className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      EXTERNAL SERVICE TEMPORARILY UNAVAILABLE — APPLICATION QUEUED FOR RETRY (NOT REJECTED)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-200/80 text-amber-950 border border-amber-400">
                    QUEUED_FOR_RETRY
                  </span>
                </div>
                <p className="text-xs text-amber-900">
                  Verification service temporarily unavailable. Your application remains active at stage{' '}
                  <span className="font-mono font-semibold">{data.application.current_stage}</span> and has been
                  queued for automatic retry. Last authoritative state is preserved.
                </p>
              </section>
            )}

            {/* 5. Prominent Professional Amber Alert Box if Action / Officer Review Required */}
            {openException && (
              <section
                data-testid="action-required-alert"
                className="bg-amber-50/90 border border-amber-300 rounded-lg p-4 sm:p-5 shadow-2xs space-y-3.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <h2 className="text-xs sm:text-sm font-bold tracking-tight text-amber-950 uppercase">
                      ACTION REQUIRED: INCOME MISMATCH UNDER OFFICER REVIEW
                    </h2>
                  </div>
                  <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded bg-amber-200/80 text-amber-950 border border-amber-400">
                    REVIEW REQUIRED — NOT REJECTED
                  </span>
                </div>

                {/* Evidence A vs Evidence B Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white border border-amber-200 rounded-md p-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold uppercase text-amber-900">Evidence A (Profile)</span>
                      <span className="font-mono">{evidenceA?.document_reference || 'PROF-DECL-20841'}</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-slate-900">
                      {evidenceA
                        ? formatClaimValue(evidenceA.claim_type, evidenceA.claim_value)
                        : `₹${data.profile.annual_income.toLocaleString('en-IN')}`}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Source: {evidenceA?.source || 'Student Profile Declaration'} (Under ₹2,50,000 limit)
                    </div>
                  </div>

                  <div className="bg-white border border-amber-200 rounded-md p-3 space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold uppercase text-amber-900">Evidence B (Certificate)</span>
                      <span className="font-mono">{evidenceB?.document_reference || 'CERT-INC-JH-88412'}</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-red-800">
                      {evidenceB
                        ? formatClaimValue(evidenceB.claim_type, evidenceB.claim_value)
                        : '₹2,80,000'}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Source: {evidenceB?.source || 'State e-District Income Adapter (Demo)'} (Exceeds ₹2,50,000 limit)
                    </div>
                  </div>
                </div>

                {/* Reason, Assigned Owner, Current Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-white/80 border border-amber-200 rounded-md p-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-slate-500">Reason &amp; Rule</div>
                    <div className="font-medium text-slate-800 mt-0.5">
                      {openException.problem_summary}
                    </div>
                    <span className="inline-block mt-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300">
                      DEMO RULE — NOT AUTHORITATIVE
                    </span>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-slate-500">Assigned Owner</div>
                    <div className="font-bold text-[#0f2942] mt-0.5">
                      {openException.owner}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      District Tribal Welfare Exception Desk
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-slate-500">Current Status</div>
                    <div className="font-mono font-bold text-amber-900 mt-0.5">
                      {openException.status} ({openException.type})
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      Rule Version: <span className="font-mono">{openException.rule_version}</span>
                    </div>
                  </div>
                </div>

                {/* Restrained Resolution Workflow Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
                  <span className="font-semibold text-amber-950">Resolution Orchestration Stage:</span>
                  <div className="flex flex-wrap items-center gap-1.5 font-mono">
                    {RESOLUTION_STEPS.map((step, i) => {
                      const isDone = i <= 2;
                      const isCurrent = i === 2;
                      return (
                        <React.Fragment key={step}>
                          <span
                            className={`px-2 py-0.5 rounded border ${
                              isCurrent
                                ? 'bg-[#0f2942] text-white border-[#0f2942] font-bold'
                                : isDone
                                ? 'bg-teal-50 text-teal-900 border-teal-200 font-semibold'
                                : 'bg-white text-slate-500 border-slate-200'
                            }`}
                          >
                            {step}
                          </span>
                          {i < RESOLUTION_STEPS.length - 1 && <span className="text-slate-400">→</span>}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </section>
            )}

            {/* If Arjun's conflict was previously resolved by the Officer, offer a one-click restore to the initial Income Conflict state */}
            {!openException && data.student.id === 'student_arjun' && (
              <section
                data-testid="arjun-resolved-banner"
                className="bg-amber-50/90 border border-amber-300 rounded-lg p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-amber-950 uppercase">
                    Post-Resolution State Active (Income Conflict Resolved by Officer)
                  </div>
                  <p className="text-xs text-amber-900">
                    This case was resolved in the Officer Portal and re-evaluated. Click &quot;Restore Income Conflict&quot; to reset back to the initial ₹2,40,000 vs ₹2,80,000 conflict state.
                  </p>
                </div>
                <button
                  type="button"
                  data-testid="restore-arjun-conflict-btn"
                  onClick={async () => {
                    await fetch('/api/demo/reset', { method: 'POST' });
                    await fetchDashboard();
                  }}
                  className="px-3.5 py-2 text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white rounded-md shrink-0 cursor-pointer"
                >
                  Restore Income Conflict State
                </button>
              </section>
            )}

            {/* TAB 1: HOME */}
            {activeTab === 'home' && (
              <div className="space-y-5">
                {/* 6. Clean Two-Column Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Current Scholarship */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Current Scholarship
                      </span>
                      <FileText className="w-4 h-4 text-teal-700" />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-base font-bold text-[#0f2942]">{data.scheme.name}</div>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                        {data.scheme.badge_text}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{data.scheme.description}</p>
                    <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Income Threshold:</span>
                        <span className="font-mono font-bold text-slate-900">
                          &lt;= ₹{Number(data.scheme.income_threshold).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Rule Version:</span>
                        <span className="font-mono text-slate-700">{data.scheme.active_rule_version}</span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 pt-0.5">
                        {data.scheme.validation_status}
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Current Application Status */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Current Application Status
                      </span>
                      <Clock className="w-4 h-4 text-teal-700" />
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-mono font-bold text-[#0f2942]">
                        {data.application.current_stage}
                      </span>
                      <span
                        className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded border ${getResultBadgeStyle(
                          data.application.status
                        )}`}
                      >
                        {data.application.status}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs space-y-1.5">
                      <div>
                        <span className="text-slate-500 font-semibold">WHERE: </span>
                        <span className="text-slate-900 font-medium">{data.application.where_is_it}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-semibold">WHY: </span>
                        <span className="text-slate-700">{data.application.why_here}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Evidence Summary */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Evidence Summary
                      </span>
                      <Shield className="w-4 h-4 text-teal-700" />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-bold text-[#0f2942] font-mono tabular-nums">
                        {`${verifiedEvidenceCount} of ${totalEvidenceCount} Evidence Items Verified`}
                      </div>
                      {conflictEvidenceCount > 0 && (
                        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-red-50 text-red-800 border border-red-200">
                          {`${conflictEvidenceCount} Conflict`}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                      {data.evidence.map((ev) => (
                        <div
                          key={ev.id}
                          className={`px-2 py-1 rounded border text-[11px] flex items-center justify-between gap-1 ${getEvidenceBadgeStyle(
                            ev.verification_status
                          )}`}
                        >
                          <span className="truncate font-medium">{ev.category}</span>
                          <span className="font-mono text-[10px] font-bold">{ev.verification_status}</span>
                        </div>
                      ))}
                    </div>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab('passport')}
                        className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open Evidence Passport</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card 4: Next Action */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Next Action
                      </span>
                      <CheckCircle2 className="w-4 h-4 text-teal-700" />
                    </div>
                    <div className="text-xs font-semibold text-slate-900 leading-relaxed">
                      {data.application.next_action}
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs flex items-center justify-between">
                      <span className="text-slate-500">Current Responsible Owner:</span>
                      <span className="font-semibold text-[#0f2942]">{data.application.owner}</span>
                    </div>
                    <div className="pt-1 flex items-center gap-4">
                      <button
                        type="button"
                        onClick={() => setActiveTab('journey')}
                        className="text-xs font-semibold text-teal-700 hover:text-teal-800 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>View Full Application Journey</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('eligibility')}
                        className="text-xs font-semibold text-[#0f2942] hover:text-teal-800 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Check Eligibility Rules</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card 5: Payment Status (Spans 2 cols on desktop) */}
                  {activePayment && (
                    <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs md:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <CreditCard className="w-4 h-4 text-teal-700" />
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Payment / DBT Visibility
                          </span>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                            DEMO DATA
                          </span>
                        </div>
                        <div className="text-sm font-bold text-[#0f2942]">
                          {activePayment.payment_status} • ₹{activePayment.amount.toLocaleString('en-IN')} ({activePayment.scheme} AY {activePayment.academic_year})
                        </div>
                        <div className="text-xs text-slate-600">
                          Sanction: <span className="font-mono font-semibold">{activePayment.sanction_status}</span> •
                          Last Updated: <span className="font-mono">{activePayment.last_updated}</span> •
                          Current Source: <span className="font-mono">{activePayment.source}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('payments')}
                        className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md whitespace-nowrap cursor-pointer"
                      >
                        View DBT Details
                      </button>
                    </div>
                  )}
                </div>

                {/* Section 9: Five Scholarship Scheme Cards */}
                <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                    <div>
                      <h2 className="text-sm font-bold text-[#0f2942]">
                        Ministry of Tribal Affairs — Five Scholarship Schemes (Check Before You Apply)
                      </h2>
                      <p className="text-xs text-slate-500">
                        All rule thresholds are stored in versioned JSON configuration and marked non-authoritative for demo evaluation.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                      DEMO - PENDING OFFICIAL GUIDELINE VALIDATION
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {schemes.map((sch) => {
                      const isTarget = sch.id === data.student.target_scheme_id;
                      return (
                        <div
                          key={sch.id}
                          data-testid={`scheme-card-${sch.id}`}
                          className={`border rounded-lg p-3.5 flex flex-col justify-between gap-3 ${
                            isTarget ? 'border-teal-600 bg-teal-50/20' : 'border-slate-200 bg-white'
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="text-xs font-bold text-[#0f2942]">{sch.name}</h3>
                              {isTarget && (
                                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-900">
                                  Active
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-600 leading-snug">{sch.description}</p>
                            <div className="pt-1 space-y-1 text-[11px]">
                              <div className="flex items-center justify-between font-mono">
                                <span className="text-slate-500">Income Limit:</span>
                                <span className="font-bold text-slate-900">
                                  &lt;= ₹{Number(sch.income_threshold).toLocaleString('en-IN')}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                                  {sch.badge_text}
                                </span>
                              </div>
                              <div className="text-[10px] font-mono text-slate-500">
                                {sch.validation_status}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRunEligibilityCheck(sch.id)}
                            className="w-full py-1.5 px-3 text-xs font-semibold rounded bg-[#0f2942] hover:bg-slate-800 text-white transition-colors cursor-pointer"
                          >
                            {`Check Eligibility (${sch.active_rule_version})`}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}

            {/* TAB 2: CHECK ELIGIBILITY (Section 11, 13, 14) */}
            {activeTab === 'eligibility' && (
              <div className="space-y-4" data-testid="eligibility-tab-content">
                <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-[#0f2942]">
                        Check Before You Apply — Deterministic Rule Engine
                      </h2>
                      <p className="text-xs text-slate-500">
                        Evaluates Student Profile + Academic + Income + ST Status + Institution + Existing Benefit against Versioned JSON Rules.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        aria-label="Select Scholarship Scheme"
                        value={selectedSchemeId || data.student.target_scheme_id}
                        onChange={(e) => setSelectedSchemeId(e.target.value)}
                        className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-md"
                      >
                        {schemes.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.active_rule_version})
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        data-testid="run-eligibility-btn"
                        disabled={checkingEligibility}
                        onClick={() => handleRunEligibilityCheck()}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-md cursor-pointer"
                      >
                        {checkingEligibility ? 'Evaluating...' : 'Evaluate Rules'}
                      </button>
                      <button
                        type="button"
                        data-testid="compare-all-schemes-btn"
                        disabled={checkingEligibility}
                        onClick={handleCompareAllSchemes}
                        className="px-3 py-1.5 text-xs font-semibold bg-[#0f2942] hover:bg-slate-800 text-white rounded-md cursor-pointer"
                      >
                        Compare All 5 Schemes
                      </button>
                    </div>
                  </div>

                  {/* 6 Structured Engine Inputs Strip */}
                  <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold uppercase tracking-wide text-slate-600">
                        Deterministic Rule Engine Inputs (6 Structured Categories)
                      </span>
                      <span className="font-mono text-slate-500">Versioned JSON Rules (schemes_v0_1.json)</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px]">
                      <div className="bg-white border border-slate-200 rounded p-2">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">1. Student Profile</div>
                        <div className="font-semibold text-slate-800 truncate">{data.student.full_name}</div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-2">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">2. Academic</div>
                        <div className="font-mono font-bold text-[#0f2942]">{data.profile.academic_category}</div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-2">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">3. Income</div>
                        <div className="font-mono font-bold text-slate-900">
                          ₹{data.profile.annual_income.toLocaleString('en-IN')}
                          {conflictEvidenceCount > 0 ? ' (Conflict)' : ''}
                        </div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-2">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">4. ST Status</div>
                        <div className="font-mono font-bold text-teal-800">{data.profile.st_status}</div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-2">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">5. Institution</div>
                        <div className="font-semibold text-slate-800 truncate">{data.profile.institution_name}</div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-2">
                        <div className="text-[10px] text-slate-400 font-semibold uppercase">6. Existing Benefit</div>
                        <div className="font-mono font-bold text-teal-800">0 (No Overlap)</div>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Scheme Comparison Matrix (when triggered) */}
                  {schemeComparisons.length > 0 && (
                    <div
                      data-testid="scheme-comparison-matrix"
                      className="border border-teal-200 bg-teal-50/20 rounded-md p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0f2942]">
                          5-Scheme Deterministic Eligibility Comparison Matrix
                        </span>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                          DEMO RULE — NOT AUTHORITATIVE
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
                        {schemeComparisons.map((comp) => (
                          <button
                            key={comp.evaluation_id}
                            type="button"
                            onClick={() => {
                              setSelectedSchemeId(comp.scheme_id);
                              setEvalResult(comp);
                            }}
                            className={`text-left border rounded p-2.5 bg-white space-y-1.5 transition-colors cursor-pointer ${
                              evalResult?.scheme_id === comp.scheme_id
                                ? 'border-teal-700 ring-1 ring-teal-700'
                                : 'border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="text-[11px] font-bold text-[#0f2942] leading-snug">
                              {comp.scheme_name}
                            </div>
                            <div className="text-[10px] font-mono text-slate-500">
                              Limit: &lt;= ₹{Number(comp.income_threshold || 250000).toLocaleString('en-IN')}
                            </div>
                            <div>
                              <span
                                className={`inline-block font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${getResultBadgeStyle(
                                  comp.result
                                )}`}
                              >
                                {comp.result}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary Header Bar */}
                  {evalResult && (
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 rounded-md p-3.5 text-xs">
                      <div>
                        <div className="text-[10px] font-semibold uppercase text-slate-500">Selected Scheme</div>
                        <div className="font-bold text-[#0f2942] mt-0.5">
                          {selectedSchemeObj?.name || data.scheme.name}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase text-slate-500">Current Rule Version</div>
                        <div className="font-mono font-bold text-slate-800 mt-0.5">
                          {evalResult.rule_set_version}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase text-slate-500">Validation Status</div>
                        <div className="font-mono text-[11px] text-amber-900 mt-0.5">
                          DEMO - PENDING OFFICIAL GUIDELINE VALIDATION
                        </div>
                        <span className="inline-block mt-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-300">
                          DEMO RULE — NOT AUTHORITATIVE
                        </span>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold uppercase text-slate-500">Eligibility Result</div>
                        <div className="mt-1">
                          <span
                            data-testid="eligibility-result-badge"
                            className={`inline-block font-mono text-xs font-bold px-2.5 py-1 rounded border ${getResultBadgeStyle(
                              evalResult.result
                            )}`}
                          >
                            {evalResult.result}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rule Breakdown Table: RULE | EVIDENCE | RESULT | REASON | NEXT ACTION */}
                  {evalResult?.rule_results && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-600">
                            <th className="py-2.5 px-3">RULE</th>
                            <th className="py-2.5 px-3">EVIDENCE</th>
                            <th className="py-2.5 px-3">RESULT</th>
                            <th className="py-2.5 px-3">REASON</th>
                            <th className="py-2.5 px-3">NEXT ACTION</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {evalResult.rule_results.map((rr) => (
                            <tr key={rr.id} className="hover:bg-slate-50/80">
                              <td className="py-3 px-3 align-top">
                                <div className="font-mono font-bold text-[#0f2942]">{rr.rule_id}</div>
                                <div className="font-mono text-[11px] text-slate-600">
                                  Expected: {rr.expected}
                                </div>
                                {rr.rule_id === 'RULE_INCOME' && (
                                  <span className="inline-block mt-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                                    DEMO RULE — NOT AUTHORITATIVE
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-3 align-top font-mono">
                                <div className="font-bold text-slate-900">{rr.actual}</div>
                                <div className="text-[11px] text-slate-500">Ref: {rr.evidence_id}</div>
                              </td>
                              <td className="py-3 px-3 align-top">
                                <span
                                  className={`inline-block font-mono text-[11px] font-bold px-2 py-0.5 rounded border ${
                                    rr.status === 'SATISFIED' || rr.status === 'CONDITIONS SATISFIED'
                                      ? 'bg-teal-50 text-teal-800 border-teal-200'
                                      : rr.status === 'REVIEW REQUIRED'
                                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                                      : 'bg-red-50 text-red-800 border-red-200'
                                  }`}
                                >
                                  {rr.status}
                                </span>
                              </td>
                              <td className="py-3 px-3 align-top text-slate-700 max-w-xs">
                                {rr.reason}
                              </td>
                              <td className="py-3 px-3 align-top text-slate-800 font-medium">
                                {rr.next_action}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: EVIDENCE PASSPORT (Section 12) */}
            {activeTab === 'passport' && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-4" data-testid="passport-tab-content">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#0f2942]">
                      Structured Evidence Passport
                    </h2>
                    <p className="text-xs text-slate-500">
                      Verified claims retrieved across Identity, ST Status, Income, Academic, Institution, and Existing Benefit adapters.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-slate-600">
                      {verifiedEvidenceCount} Verified • {conflictEvidenceCount} Conflict
                    </span>
                    <button
                      type="button"
                      data-testid="verify-passport-adapters-btn"
                      disabled={verifyingPassport}
                      onClick={handleVerifyEvidencePassport}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-md cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${verifyingPassport ? 'animate-spin' : ''}`} />
                      <span>{verifyingPassport ? 'Checking Adapters...' : 'Verify Passport via Adapters'}</span>
                    </button>
                  </div>
                </div>

                {passportVerifyMessage && (
                  <div
                    role="status"
                    data-testid="passport-verify-banner"
                    className={`rounded-md p-3 text-xs font-medium border ${
                      data.outageActive
                        ? 'bg-amber-50 border-amber-300 text-amber-950'
                        : 'bg-teal-50 border-teal-300 text-teal-950'
                    }`}
                  >
                    {passportVerifyMessage}
                  </div>
                )}

                {/* Status Badge Legend & Simulated Integration Adapters Strip */}
                <div className="bg-slate-50 border border-slate-200 rounded-md p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-[11px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-slate-500 mr-1">Passport Status Legend:</span>
                    <span className="font-mono font-bold px-2 py-0.5 rounded border bg-teal-50 text-teal-800 border-teal-200">
                      VERIFIED
                    </span>
                    <span className="font-mono font-bold px-2 py-0.5 rounded border bg-amber-50 text-amber-800 border-amber-200">
                      PENDING
                    </span>
                    <span className="font-mono font-bold px-2 py-0.5 rounded border bg-red-50 text-red-800 border-red-200">
                      CONFLICT
                    </span>
                    <span className="font-mono font-bold px-2 py-0.5 rounded border bg-amber-50 text-slate-700 border-amber-200">
                      EXPIRED
                    </span>
                    <span className="font-mono font-bold px-2 py-0.5 rounded border bg-slate-100 text-slate-600 border-slate-200">
                      UNAVAILABLE
                    </span>
                  </div>

                  {data.adapters && data.adapters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-500">Simulated Adapters:</span>
                      {data.adapters.map((ad) => (
                        <span
                          key={ad.id}
                          className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            ad.status === 'OPERATIONAL'
                              ? 'bg-white text-teal-800 border-slate-200'
                              : 'bg-amber-100 text-amber-950 border-amber-300'
                          }`}
                        >
                          {ad.adapter_name}: {ad.status}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {data.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="border border-slate-200 rounded-lg p-3.5 bg-white shadow-2xs flex flex-col justify-between gap-2.5"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold uppercase tracking-wide text-[#0f2942]">
                            {ev.category}
                          </span>
                          <span
                            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${getEvidenceBadgeStyle(
                              ev.verification_status
                            )}`}
                          >
                            {ev.verification_status}
                          </span>
                        </div>

                        <div className="text-sm font-bold font-mono text-slate-900 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
                          {formatClaimValue(ev.claim_type, ev.claim_value)}
                        </div>
                      </div>

                      <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-100 pt-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400">Source:</span>
                          <span className="font-medium text-slate-800 text-right">{ev.source}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400">Provenance Label:</span>
                          <span className="font-mono text-[10px] text-slate-700">{ev.source_type}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400">Document Ref:</span>
                          <span className="font-mono text-slate-800">{ev.document_reference}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400">Last Verified:</span>
                          <span className="font-mono">{ev.retrieved_at.slice(0, 10)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-slate-400">Valid Until:</span>
                          <span className="font-mono">{ev.valid_until}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: APPLICATION JOURNEY (Section 21 & 28) */}
            {activeTab === 'journey' && (
              <div className="space-y-4" data-testid="journey-tab-content">
                <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h2 className="text-sm font-bold text-[#0f2942]">
                        Unified Scholarship Application Journey
                      </h2>
                      <p className="text-xs text-slate-500">
                        9-stage state machine with transparent WHERE, WHY, OWNER, and NEXT ACTION visibility.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-1 rounded">
                      Ref: {data.application.tracking_reference}
                    </span>
                  </div>

                  {/* Horizontal / Responsive 9-Stage Stepper */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-9 gap-2">
                    {APPLICATION_STAGES.map((stage, idx) => {
                      const isCompleted = idx < currentStageIndex;
                      const isCurrent = idx === currentStageIndex;
                      return (
                        <div
                          key={stage.code}
                          className={`border rounded-md p-2.5 text-xs flex flex-col justify-between gap-1 ${
                            isCurrent
                              ? 'bg-[#0f2942] text-white border-[#0f2942] shadow-2xs'
                              : isCompleted
                              ? 'bg-teal-50/70 text-teal-950 border-teal-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] font-mono">
                            <span>0{idx + 1}</span>
                            <span>{isCurrent ? 'CURRENT' : isCompleted ? 'DONE' : 'PENDING'}</span>
                          </div>
                          <div className="font-bold text-[11px] leading-snug">{stage.label}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Current Stage Details: WHERE | WHY | OWNER | NEXT ACTION */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        WHERE (Current System / Desk)
                      </div>
                      <div className="text-xs font-bold text-[#0f2942]">{data.application.where_is_it}</div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        WHY (Current Stage Reason)
                      </div>
                      <div className="text-xs text-slate-800">{data.application.why_here}</div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        OWNER (Responsible Actor)
                      </div>
                      <div className="text-xs font-bold text-teal-800">{data.application.owner}</div>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-md p-3.5 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        NEXT ACTION
                      </div>
                      <div className="text-xs font-semibold text-slate-900">{data.application.next_action}</div>
                    </div>
                  </div>
                </div>

                {/* Assisted Access / CSC Consent Record (Section 28) */}
                {data.consent && (
                  <div className="bg-white border border-teal-300 rounded-lg p-4 sm:p-5 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-teal-700" />
                        <h3 className="text-xs font-bold uppercase tracking-wide text-[#0f2942]">
                          Assisted Access &amp; Consent Record (Digital-First, Not Digital-Only)
                        </h3>
                      </div>
                      <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded">
                        {data.consent.tracking_reference}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Assistance Point / CSC
                        </span>
                        <span className="font-semibold text-slate-900">{data.consent.assistance_point}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Operator &amp; Consent Status
                        </span>
                        <span className="font-mono font-semibold text-teal-800">
                          {data.consent.operator_id} • {data.consent.consent_status}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Consent Scope
                        </span>
                        <span className="text-slate-700">{data.consent.consent_scope}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: PAYMENTS (Section 22) */}
            {activeTab === 'payments' && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-4" data-testid="payments-tab-content">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-[#0f2942]">
                      Direct Benefit Transfer (DBT) &amp; Payment Visibility
                    </h2>
                    <p className="text-xs text-slate-500">
                      Preserves the last authoritative simulated state even when external payment gateways are unavailable.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-slate-100 text-slate-800 border border-slate-300">
                    DEMO DATA
                  </span>
                </div>

                {data.payments.map((pay) => (
                  <div key={pay.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                      <div>
                        <span className="text-xs font-bold text-[#0f2942]">
                          {pay.scheme} Scholarship (AY {pay.academic_year})
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                        DEMO DATA
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                      <div className="bg-white border border-slate-200 rounded p-2.5">
                        <div className="text-[10px] uppercase text-slate-400 font-semibold">Sanction Status</div>
                        <div className="font-mono font-bold text-slate-900 mt-0.5">{pay.sanction_status}</div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-2.5">
                        <div className="text-[10px] uppercase text-slate-400 font-semibold">
                          Last Known Status
                        </div>
                        <div className="font-bold text-teal-800 mt-0.5">{pay.payment_status}</div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-2.5">
                        <div className="text-[10px] uppercase text-slate-400 font-semibold">Amount</div>
                        <div className="font-mono font-bold text-slate-900 mt-0.5">
                          ₹{pay.amount.toLocaleString('en-IN')}
                        </div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-2.5">
                        <div className="text-[10px] uppercase text-slate-400 font-semibold">Current Source</div>
                        <div className="font-mono text-slate-800 mt-0.5">{pay.source}</div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-2.5">
                        <div className="text-[10px] uppercase text-slate-400 font-semibold">Last Updated</div>
                        <div className="font-mono text-slate-800 mt-0.5">{pay.last_updated}</div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-2.5">
                        <div className="text-[10px] uppercase text-slate-400 font-semibold">Freshness</div>
                        <div className="font-mono text-[11px] text-slate-700 mt-0.5">{pay.freshness}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB 6: NOTIFICATIONS (Section 25) */}
            {activeTab === 'notifications' && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-3" data-testid="notifications-tab-content">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-teal-700" />
                    <h2 className="text-sm font-bold text-[#0f2942]">System Event Notifications</h2>
                  </div>
                  <span className="text-xs font-mono text-slate-500">
                    {data.notifications.length} Events
                  </span>
                </div>

                <div className="space-y-2.5">
                  {data.notifications.map((n) => (
                    <div
                      key={n.id}
                      className="border border-slate-200 rounded-md p-3.5 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-[#0f2942]">
                            {n.event_type}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{n.title}</span>
                        </div>
                        <p className="text-xs text-slate-700">{n.message}</p>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 shrink-0">
                        {n.created_at.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 7: JAGO DETERMINISTIC GUIDANCE (Section 29) */}
            {activeTab === 'jago' && (
              <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-4" data-testid="jago-tab-content">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-teal-700" />
                    <div>
                      <h2 className="text-sm font-bold text-[#0f2942]">
                        JAGO — Deterministic Student Scholarship Guidance
                      </h2>
                      <p className="text-xs text-slate-500">
                        Responses are generated strictly from verified SQLite state. JAGO never makes AI eligibility decisions.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    DETERMINISTIC ENGINE
                  </span>
                </div>

                {/* 5 Canonical Quick Questions (Section 29) */}
                <div className="flex flex-wrap gap-2">
                  {[
                    'What is my application status?',
                    'What document is missing?',
                    'What should I do next?',
                    'What is my payment status?',
                    'What does this scholarship require?',
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => handleAskJago(q)}
                      className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 border border-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Custom Question Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAskJago(jagoQuery);
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={jagoQuery}
                    onChange={(e) => setJagoQuery(e.target.value)}
                    placeholder="Ask a question about your application, documents, payment, or scheme rules..."
                    className="flex-1 px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white rounded-md cursor-pointer"
                  >
                    Ask JAGO
                  </button>
                </form>

                {/* Deterministic Responses Log */}
                <div className="space-y-2.5 pt-1">
                  {jagoHistory.length === 0 ? (
                    <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-3.5">
                      Select any question above to inspect deterministic responses pulled directly from your SetuOne record.
                    </div>
                  ) : (
                    jagoHistory.map((item, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-md p-3.5 bg-slate-50 space-y-1.5 text-xs">
                        <div className="font-bold text-[#0f2942]">Q: {item.q}</div>
                        <div className="text-slate-800 bg-white border border-slate-200 rounded p-2.5">
                          {item.a}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PortalLayout>
  );
};
