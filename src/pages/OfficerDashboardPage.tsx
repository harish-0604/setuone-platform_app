import React, { useEffect, useState, useCallback } from 'react';
import {
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ShieldCheck,
  Clock,
  FileCheck,
  ArrowUpRight,
  RefreshCw,
  Users,
} from 'lucide-react';
import { PortalLayout } from '../layouts/PortalLayout.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { EvidenceItem } from '../types/index.ts';

const RESOLUTION_STEPS = ['Detect', 'Explain', 'Assign', 'Resolve', 'Re-evaluate', 'Continue'];

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  before_state: string;
  after_state: string;
  rule_version: string;
  evidence_reference: string;
}

interface OfficerExceptionRecord {
  id: string;
  conflict_id: string;
  student_id: string;
  student_name: string;
  tracking_reference: string;
  scheme_id: string;
  scheme_name: string;
  scheme_badge: string;
  scheme_validation_status: string;
  income_threshold: number;
  type: string;
  problem_summary: string;
  evidence_a_id: string;
  evidence_b_id: string;
  affected_rule: string;
  rule_version: string;
  owner: string;
  status: string;
  case_age: string;
  recommended_action: string;
  evidence_a?: EvidenceItem;
  evidence_b?: EvidenceItem;
  audit_timeline?: AuditLogEntry[];
  latest_evaluation?: {
    evaluation_id: string;
    result: string;
    rule_set_version: string;
    summary_reason: string;
  };
}

interface OutreachCandidate {
  id: string;
  district: string;
  state: string;
  education_level: string;
  enrolled_st_count: number;
  matched_scholarship_count: number;
  potential_coverage_gap: number;
  screening_status: string;
  classification_label: string;
  updated_at: string;
}

interface OfficerDashboardData {
  metrics: {
    totalCases: number;
    straightThroughCases: number;
    openExceptions: number;
    resolvedCases: number;
  };
  exceptions: OfficerExceptionRecord[];
  outreachCandidates: OutreachCandidate[];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export const OfficerDashboardPage: React.FC = () => {
  const { session, getAuthHeaders } = useAuth();
  const [data, setData] = useState<OfficerDashboardData | null>(null);
  const [selectedExceptionId, setSelectedExceptionId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'queue' | 'outreach'>('queue');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOfficerDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/exceptions', {
        headers: getAuthHeaders(),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || body.error || 'Failed to load officer dashboard');
      }
      const parsed = body as OfficerDashboardData;
      setData(parsed);
      if (!selectedExceptionId && parsed.exceptions?.length > 0) {
        setSelectedExceptionId(parsed.exceptions[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading officer command centre');
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, selectedExceptionId]);

  useEffect(() => {
    fetchOfficerDashboard();
  }, [fetchOfficerDashboard]);

  const handleResolveCase = async (
    exceptionId: string,
    acceptedValue: number,
    acceptedSource: string
  ) => {
    setActionBusy(`resolve-${acceptedValue}`);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/exceptions/${exceptionId}/resolve`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          accepted_value: acceptedValue,
          accepted_source: acceptedSource,
          notes: `Officer verified authoritative income ₹${acceptedValue.toLocaleString('en-IN')} (${acceptedSource}) and triggered automatic re-evaluation.`,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.error || 'Resolution failed');
      }
      await fetchOfficerDashboard();
      setActionFeedback(
        `Case ${exceptionId} RESOLVED with confirmed income ₹${acceptedValue.toLocaleString(
          'en-IN'
        )}. Automatic eligibility re-evaluation result: ${body.evaluation?.result}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve exception');
    } finally {
      setActionBusy(null);
    }
  };

  const handleSecondaryOfficerAction = async (
    exceptionId: string,
    endpointSuffix: 'request-info' | 'escalate' | 'reevaluate',
    label: string
  ) => {
    setActionBusy(endpointSuffix);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/exceptions/${exceptionId}/${endpointSuffix}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error(`Action ${label} failed`);
      }
      await fetchOfficerDashboard();
      setActionFeedback(`Action completed: ${label} for exception ${exceptionId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Officer action failed');
    } finally {
      setActionBusy(null);
    }
  };

  const navItems = [
    {
      id: 'queue',
      label: 'Exception Command Centre',
      active: activeTab === 'queue',
      onClick: () => setActiveTab('queue'),
    },
    {
      id: 'outreach',
      label: `Outreach & Retention Signals (${data?.outreachCandidates?.length ?? 3})`,
      active: activeTab === 'outreach',
      onClick: () => setActiveTab('outreach'),
    },
  ];

  const selectedCase =
    data?.exceptions?.find((e) => e.id === selectedExceptionId) ||
    data?.exceptions?.[0];

  const isSelectedResolved =
    selectedCase?.status === 'RESOLVED' || selectedCase?.status === 'CLOSED';

  return (
    <PortalLayout portalLabel="Scholarship Officer" navItems={navItems}>
      <div className="space-y-5" data-testid="officer-dashboard">
        {/* Officer Identity Header */}
        <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-[#0f2942] text-teal-300 font-bold text-sm flex items-center justify-center shrink-0">
              {getInitials(session?.fullName || 'Officer')}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-[#0f2942] leading-none">
                  {session?.fullName}
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                  Scholarship Officer
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  SSO: {session?.demoId}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                Desk: <span className="font-semibold text-slate-800">District Tribal Welfare Exception &amp; Resolution Desk</span> •
                State: <span className="font-semibold text-slate-800">Jharkhand</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchOfficerDashboard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-md cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Queue</span>
            </button>
          </div>
        </section>

        {loading && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-xs text-slate-600 shadow-2xs">
            Loading Officer Exception Command Centre from SQLite...
          </div>
        )}

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs text-red-800">
            {error}
          </div>
        )}

        {actionFeedback && (
          <div
            role="status"
            data-testid="officer-resolution-banner"
            className="bg-teal-50 border border-teal-300 rounded-lg p-3.5 text-xs text-teal-950 font-medium flex items-center gap-2 shadow-2xs"
          >
            <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {!loading && data && activeTab === 'queue' && (
          <>
            {/* 4 Summary Metric Cards: Total Cases | Open Exceptions | Resolved Cases | Straight-Through Cases */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Total Cases</span>
                  <Layers className="w-4 h-4 text-[#0f2942]" />
                </div>
                <div className="text-2xl font-bold font-mono text-[#0f2942] tabular-nums" data-testid="metric-total-cases">
                  {data.metrics.totalCases}
                </div>
                <div className="text-[11px] text-slate-500">Active scholarship applications</div>
              </div>

              <div className="bg-amber-50/70 border border-amber-300 rounded-lg p-4 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-amber-900">
                  <span>Open Exceptions</span>
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                </div>
                <div className="text-2xl font-bold font-mono text-amber-950 tabular-nums" data-testid="metric-open-exceptions">
                  {data.metrics.openExceptions}
                </div>
                <div className="text-[11px] text-amber-800">Requiring officer resolution</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Resolved Cases</span>
                  <Briefcase className="w-4 h-4 text-teal-700" />
                </div>
                <div className="text-2xl font-bold font-mono text-teal-800 tabular-nums" data-testid="metric-resolved-cases">
                  {data.metrics.resolvedCases}
                </div>
                <div className="text-[11px] text-slate-500">Re-evaluated after resolution</div>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Straight-Through Cases</span>
                  <CheckCircle2 className="w-4 h-4 text-teal-700" />
                </div>
                <div className="text-2xl font-bold font-mono text-[#0f2942] tabular-nums" data-testid="metric-stp-cases">
                  {data.metrics.straightThroughCases}
                </div>
                <div className="text-[11px] text-slate-500">Zero-conflict automated flow</div>
              </div>
            </div>

            {/* Professional Case Table: Student | Exception Type | Status | Owner | Age | Action */}
            <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-teal-700" />
                  <h2 className="text-sm font-bold text-[#0f2942]">
                    Exception Queue — Cases Requiring Officer Review
                  </h2>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Detect → Explain → Assign → Resolve → Re-evaluate → Continue
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase text-slate-600">
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Exception Type</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Owner</th>
                      <th className="py-2.5 px-3">Age</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.exceptions.map((exc) => {
                      const isRowSelected = exc.id === selectedCase?.id;
                      const isResolved = exc.status === 'RESOLVED' || exc.status === 'CLOSED';
                      return (
                        <tr
                          key={exc.id}
                          onClick={() => setSelectedExceptionId(exc.id)}
                          className={`cursor-pointer transition-colors ${
                            isRowSelected ? 'bg-teal-50/40' : 'hover:bg-slate-50'
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="font-bold text-[#0f2942]">{exc.student_name}</div>
                            <div className="font-mono text-[11px] text-slate-500">
                              Ref: {exc.tracking_reference} • {exc.scheme_name}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono font-bold text-amber-900">
                            {exc.type}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                                isResolved
                                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                                  : 'bg-amber-100 text-amber-900 border-amber-300'
                              }`}
                            >
                              {exc.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-800 font-medium">{exc.owner}</td>
                          <td className="py-3 px-3 font-mono text-slate-600">{exc.case_age}</td>
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedExceptionId(exc.id);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-[#0f2942] text-white hover:bg-slate-800 cursor-pointer"
                            >
                              {isResolved ? 'Inspect Resolution' : 'Review & Resolve'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Selected Case Detail Section */}
            {selectedCase && (
              <section
                data-testid="officer-case-detail"
                className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-4"
              >
                {/* Header & Resolution Flow Stepper */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-[#0f2942]">
                        Case Detail: {selectedCase.student_name} ({selectedCase.tracking_reference})
                      </h3>
                      <span
                        className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                          isSelectedResolved
                            ? 'bg-teal-50 text-teal-800 border-teal-200'
                            : 'bg-amber-100 text-amber-900 border-amber-300'
                        }`}
                      >
                        {selectedCase.status}
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                        {selectedCase.scheme_badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{selectedCase.problem_summary}</p>
                  </div>

                  {/* Resolution Flow Strip: Detect -> Explain -> Assign -> Resolve -> Re-evaluate -> Continue */}
                  <div className="flex flex-wrap items-center gap-1 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-md px-3 py-2">
                    {RESOLUTION_STEPS.map((step, idx) => {
                      const activeStepIdx = isSelectedResolved ? 5 : 3;
                      const isDone = idx < activeStepIdx || isSelectedResolved;
                      const isCurrent = idx === activeStepIdx && !isSelectedResolved;
                      return (
                        <React.Fragment key={step}>
                          <span
                            className={`px-1.5 py-0.5 rounded border ${
                              isCurrent
                                ? 'bg-[#0f2942] text-white border-[#0f2942] font-bold'
                                : isDone
                                ? 'bg-teal-50 text-teal-800 border-teal-200 font-semibold'
                                : 'bg-white text-slate-400 border-slate-200'
                            }`}
                          >
                            {step}
                          </span>
                          {idx < RESOLUTION_STEPS.length - 1 && (
                            <span className="text-slate-400">→</span>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>

                {/* Compact Cards for Evidence A, Evidence B, Affected Rule, Rule Version, Owner, Recommended Next Action */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {/* Card 1: Evidence A */}
                  <div className="border border-slate-200 rounded-md p-3.5 bg-slate-50 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
                      <span>Evidence A (Student Profile)</span>
                      <span className="font-mono text-teal-800">
                        {selectedCase.evidence_a?.document_reference || 'PROF-DECL-20841'}
                      </span>
                    </div>
                    <div className="text-base font-bold font-mono text-[#0f2942]">
                      ₹{Number(selectedCase.evidence_a?.claim_value || 240000).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Source: {selectedCase.evidence_a?.source || 'Student Profile Declaration'}
                    </div>
                    <div className="text-[10px] font-mono text-teal-800 font-semibold">
                      Satisfies &lt;= ₹{Number(selectedCase.income_threshold).toLocaleString('en-IN')} threshold
                    </div>
                  </div>

                  {/* Card 2: Evidence B */}
                  <div className="border border-amber-200 rounded-md p-3.5 bg-amber-50/40 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase text-amber-900">
                      <span>Evidence B (Income Certificate)</span>
                      <span className="font-mono text-amber-900">
                        {selectedCase.evidence_b?.document_reference || 'CERT-INC-JH-88412'}
                      </span>
                    </div>
                    <div className="text-base font-bold font-mono text-red-800">
                      ₹{Number(selectedCase.evidence_b?.claim_value || 280000).toLocaleString('en-IN')}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Source: {selectedCase.evidence_b?.source || 'State e-District Income Adapter (Demo)'}
                    </div>
                    <div className="text-[10px] font-mono text-amber-900 font-semibold">
                      Straddles / exceeds ₹{Number(selectedCase.income_threshold).toLocaleString('en-IN')} limit
                    </div>
                  </div>

                  {/* Card 3: Affected Rule & Rule Version */}
                  <div className="border border-slate-200 rounded-md p-3.5 bg-slate-50 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-500">
                      <span>Affected Rule &amp; Version</span>
                      <span className="font-mono text-slate-700">{selectedCase.rule_version}</span>
                    </div>
                    <div className="text-sm font-bold font-mono text-[#0f2942]">
                      {selectedCase.affected_rule} (annual_income &lt;= ₹{Number(selectedCase.income_threshold).toLocaleString('en-IN')})
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Scheme: <span className="font-semibold">{selectedCase.scheme_name}</span>
                    </div>
                    <span className="inline-block text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                      DEMO RULE — NOT AUTHORITATIVE
                    </span>
                  </div>

                  {/* Card 4: Owner */}
                  <div className="border border-slate-200 rounded-md p-3.5 bg-white space-y-1">
                    <div className="text-[10px] font-bold uppercase text-slate-500">Assigned Owner</div>
                    <div className="text-xs font-bold text-[#0f2942]">{selectedCase.owner}</div>
                    <div className="text-[11px] text-slate-600">
                      Officer: Sample 5 • Case Age: <span className="font-mono">{selectedCase.case_age}</span>
                    </div>
                  </div>

                  {/* Card 5: Recommended Next Action */}
                  <div className="border border-slate-200 rounded-md p-3.5 bg-white md:col-span-2 space-y-1">
                    <div className="text-[10px] font-bold uppercase text-slate-500">
                      Recommended Next Action
                    </div>
                    <div className="text-xs font-semibold text-slate-900">
                      {selectedCase.recommended_action}
                    </div>
                    {selectedCase.latest_evaluation && (
                      <div className="text-[11px] text-slate-600 pt-0.5">
                        Latest Evaluation Result:{' '}
                        <span className="font-mono font-bold text-[#0f2942]">
                          {selectedCase.latest_evaluation.result}
                        </span>{' '}
                        ({selectedCase.latest_evaluation.rule_set_version})
                      </div>
                    )}
                  </div>
                </div>

                {/* Officer Resolution Actions Bar */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold text-[#0f2942] flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-teal-700" />
                      <span>Officer Resolution Decision (Triggers Automatic Re-Evaluation &amp; Audit Event)</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      Section 19 &amp; 33 Deterministic Resolution Engine
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      data-testid="resolve-accept-240k-btn"
                      disabled={actionBusy !== null}
                      onClick={() =>
                        handleResolveCase(
                          selectedCase.id,
                          240000,
                          'Verified Corrected Income Certificate (₹2,40,000)'
                        )
                      }
                      className="px-3.5 py-2 text-xs font-semibold rounded-md bg-teal-700 hover:bg-teal-800 text-white shadow-2xs cursor-pointer"
                    >
                      {actionBusy === 'resolve-240000'
                        ? 'Resolving & Re-evaluating...'
                        : 'Accept Corrected Evidence (₹2,40,000 <= ₹2,50,000) & Re-evaluate'}
                    </button>

                    <button
                      type="button"
                      data-testid="resolve-confirm-280k-btn"
                      disabled={actionBusy !== null}
                      onClick={() =>
                        handleResolveCase(
                          selectedCase.id,
                          280000,
                          'State e-District Income Certificate Confirmed (₹2,80,000)'
                        )
                      }
                      className="px-3.5 py-2 text-xs font-semibold rounded-md bg-[#0f2942] hover:bg-slate-800 text-white shadow-2xs cursor-pointer"
                    >
                      {actionBusy === 'resolve-280000'
                        ? 'Updating...'
                        : 'Confirm Certificate Income (₹2,80,000 > ₹2,50,000) & Re-evaluate'}
                    </button>

                    <button
                      type="button"
                      disabled={actionBusy !== null}
                      onClick={() =>
                        handleSecondaryOfficerAction(
                          selectedCase.id,
                          'request-info',
                          'Request Additional Info'
                        )
                      }
                      className="px-3 py-2 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 cursor-pointer"
                    >
                      Request Additional Info
                    </button>

                    <button
                      type="button"
                      data-testid="officer-reevaluate-btn"
                      disabled={actionBusy !== null}
                      onClick={() =>
                        handleSecondaryOfficerAction(
                          selectedCase.id,
                          'reevaluate',
                          'Manual Eligibility Re-Evaluation'
                        )
                      }
                      className="px-3 py-2 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 text-[#0f2942] border border-slate-300 cursor-pointer inline-flex items-center gap-1"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Re-evaluate Rules</span>
                    </button>

                    <button
                      type="button"
                      disabled={actionBusy !== null}
                      onClick={() =>
                        handleSecondaryOfficerAction(selectedCase.id, 'escalate', 'Escalate Case')
                      }
                      className="px-3 py-2 text-xs font-semibold rounded-md bg-white hover:bg-slate-100 text-amber-900 border border-amber-300 cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>Escalate Case</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card 7: Audit Timeline */}
                <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-2.5" data-testid="officer-audit-timeline">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#0f2942]">
                      <Clock className="w-3.5 h-3.5 text-teal-700" />
                      <span>Audit Timeline (Decision Provenance &amp; State Transitions)</span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">
                      {selectedCase.audit_timeline?.length ?? 0} Recorded Events
                    </span>
                  </div>

                  <div className="space-y-2">
                    {selectedCase.audit_timeline?.map((log) => (
                      <div
                        key={log.id}
                        className="bg-slate-50 border border-slate-200 rounded p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono"
                      >
                        <div>
                          <span className="text-slate-500 mr-2">{log.timestamp}</span>
                          <span className="font-bold text-[#0f2942] mr-2">{log.actor}</span>
                          <span className="font-sans font-medium text-slate-800">{log.action}</span>
                        </div>
                        <div className="text-[11px] text-slate-600 shrink-0">
                          <span>{log.before_state}</span>
                          <span className="mx-1.5 text-slate-400">→</span>
                          <span className="font-bold text-teal-800">{log.after_state}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* Outreach & Retention Signals Tab (Section 27) */}
        {!loading && data && activeTab === 'outreach' && (
          <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-teal-700" />
                <div>
                  <h2 className="text-sm font-bold text-[#0f2942]">
                    Proactive Tribal Student Outreach &amp; Drop-Off Prevention Signals
                  </h2>
                  <p className="text-xs text-slate-500">
                    Identifies eligible ST students at risk of drop-off between Class 10 and Post-Matric transition.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                DEMO OUTREACH SIGNAL — SIMULATED
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {data.outreachCandidates?.map((cand) => (
                <div
                  key={cand.id}
                  className="border border-slate-200 rounded-lg p-3.5 bg-slate-50 flex flex-col justify-between gap-2.5 text-xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#0f2942]">
                        {cand.district}, {cand.state}
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                        {cand.classification_label}
                      </span>
                    </div>
                    <div className="font-semibold text-slate-700 text-[11px]">
                      Cohort: {cand.education_level}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px] font-mono">
                      <div className="bg-white border border-slate-200 rounded p-1.5">
                        <div className="text-[9px] text-slate-400 uppercase font-sans">Enrolled</div>
                        <div className="font-bold text-slate-800">{cand.enrolled_st_count.toLocaleString('en-IN')}</div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded p-1.5">
                        <div className="text-[9px] text-slate-400 uppercase font-sans">Matched</div>
                        <div className="font-bold text-teal-800">{cand.matched_scholarship_count.toLocaleString('en-IN')}</div>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded p-1.5">
                        <div className="text-[9px] text-amber-900 uppercase font-sans">Gap</div>
                        <div className="font-bold text-amber-950">{cand.potential_coverage_gap.toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-teal-800">{cand.classification_label}</span>
                    <span className="font-mono text-slate-500">{cand.screening_status}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </PortalLayout>
  );
};
