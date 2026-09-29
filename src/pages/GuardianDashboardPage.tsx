import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileText,
  CreditCard,
  Clock,
  Shield,
} from 'lucide-react';
import { PortalLayout } from '../layouts/PortalLayout.tsx';
import { useAuth } from '../contexts/AuthContext.tsx';
import { EvidenceItem } from '../types/index.ts';

interface LinkedChildRecord {
  student_id: string;
  full_name: string;
  scenario_tag: string;
  tracking_reference: string;
  profile_completeness: number;
  relationship: string;
  academic_level: string;
  institution_name: string;
  district: string;
  state: string;
  st_tribe_name: string;
  annual_income: number;
  scheme_name: string;
  benefit_summary: string;
  income_threshold: number;
  scheme_badge: string;
  active_rule_version: string;
  current_stage: string;
  application_status: string;
  where_is_it: string;
  why_here: string;
  stage_owner: string;
  next_action: string;
  evidence: EvidenceItem[];
  payments: Array<{
    id: string;
    scheme: string;
    academic_year: string;
    sanction_status: string;
    payment_status: string;
    amount: number;
    last_updated: string;
    source: string;
  }>;
  exceptions: Array<{
    id: string;
    type: string;
    problem_summary: string;
    affected_rule: string;
    rule_version: string;
    owner: string;
    status: string;
    recommended_action: string;
  }>;
}

interface GuardianDashboardData {
  guardian: {
    id: string;
    full_name: string;
    relationship: string;
    district: string;
  };
  linkedChildrenCount: number;
  linkedChildren: LinkedChildRecord[];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export const GuardianDashboardPage: React.FC = () => {
  const { session, getAuthHeaders } = useAuth();
  const [data, setData] = useState<GuardianDashboardData | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'children' | 'scope'>('children');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGuardianData = useCallback(async () => {
    if (!session?.guardianId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/guardians/${session.guardianId}/dashboard`, {
        headers: getAuthHeaders(),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message || body.error || 'Failed to load guardian dashboard');
      }
      const parsed = body as GuardianDashboardData;
      setData(parsed);
      if (!selectedChildId && parsed.linkedChildren?.length > 0) {
        setSelectedChildId(parsed.linkedChildren[0].student_id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading guardian dashboard');
    } finally {
      setLoading(false);
    }
  }, [session?.guardianId, getAuthHeaders, selectedChildId]);

  useEffect(() => {
    fetchGuardianData();
  }, [fetchGuardianData]);

  const navItems = [
    {
      id: 'children',
      label: `My Children (${data?.linkedChildrenCount ?? 2})`,
      active: activeTab === 'children',
      onClick: () => setActiveTab('children'),
    },
    {
      id: 'scope',
      label: 'Family Access & RBAC Scope',
      active: activeTab === 'scope',
      onClick: () => setActiveTab('scope'),
    },
  ];

  const selectedChild =
    data?.linkedChildren?.find((c) => c.student_id === selectedChildId) ||
    data?.linkedChildren?.[0];

  const openChildException = selectedChild?.exceptions?.find(
    (e) => e.status !== 'RESOLVED' && e.status !== 'CLOSED'
  );

  return (
    <PortalLayout portalLabel="Guardian" navItems={navItems}>
      <div className="space-y-5" data-testid="guardian-dashboard">
        {/* Guardian Identity Bar */}
        <section className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-[#0f2942] text-teal-300 font-bold text-sm flex items-center justify-center shrink-0">
              {getInitials(session?.fullName || 'Guardian')}
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-bold text-[#0f2942] leading-none">
                  {session?.fullName}
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                  Verified Guardian
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                  ID: {session?.demoId}
                </span>
              </div>
              <div className="text-xs text-slate-600">
                Relationship: <span className="font-semibold text-slate-800">{data?.guardian?.relationship || 'Mother'}</span> •
                Domicile: <span className="font-semibold text-slate-800">{data?.guardian?.district || 'Ranchi, Jharkhand'}</span> •
                Authorized Scope: Linked Children Only
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2 text-right shrink-0">
            <div className="text-[10px] uppercase font-semibold text-slate-500">
              Linked Family Beneficiaries
            </div>
            <div className="text-sm font-bold font-mono text-[#0f2942] tabular-nums">
              {data?.linkedChildrenCount ?? 2} Linked Student Records
            </div>
          </div>
        </section>

        {loading && (
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-xs text-slate-600 shadow-2xs">
            Loading linked family scholarship records from SQLite...
          </div>
        )}

        {error && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-xs text-red-800">
            {error}
          </div>
        )}

        {!loading && data && activeTab === 'children' && (
          <div className="space-y-5">
            {/* Child Selector Strip (Strictly Linked Children Only: Meena & Arjun) */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-teal-700" />
                  <span>Select Linked Child Record (Separate Passports — Never Merged)</span>
                </h2>
                <span className="text-[11px] font-mono text-slate-500">
                  guardian_student_links
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {data.linkedChildren.map((child) => {
                  const isSelected = child.student_id === selectedChild?.student_id;
                  const hasConflict = child.application_status === 'REVIEW REQUIRED';
                  return (
                    <button
                      key={child.student_id}
                      type="button"
                      data-testid={`guardian-child-card-${child.student_id}`}
                      onClick={() => setSelectedChildId(child.student_id)}
                      className={`text-left rounded-lg p-4 border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-white border-teal-700 ring-1 ring-teal-700 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-[#0f2942]">{child.full_name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                              {child.tracking_reference}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {child.academic_level} • {child.institution_name}
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                            hasConflict
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-teal-50 text-teal-800 border-teal-200'
                          }`}
                        >
                          {child.application_status}
                        </span>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-800">{child.scheme_name}</span>
                        <span className="font-mono">Stage: {child.current_stage}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Selected Child Detailed View */}
            {selectedChild && (
              <div className="space-y-4" data-testid="selected-child-panel">
                {openChildException && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 shadow-2xs space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-950 uppercase">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>
                          {selectedChild.full_name}: ACTION REQUIRED — {openChildException.type} UNDER OFFICER REVIEW
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-amber-200/80 text-amber-950 border border-amber-400">
                        REVIEW REQUIRED — NOT REJECTED
                      </span>
                    </div>
                    <p className="text-xs text-amber-900">{openChildException.problem_summary}</p>
                    <div className="text-[11px] text-amber-950 font-medium">
                      Assigned Owner: <span className="font-bold">{openChildException.owner}</span> •
                      Rule Version: <span className="font-mono">{openChildException.rule_version}</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Scholarship & Eligibility Card */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        {selectedChild.full_name} — Scholarship Scheme
                      </span>
                      <FileText className="w-4 h-4 text-teal-700" />
                    </div>
                    <div className="text-sm font-bold text-[#0f2942]">{selectedChild.scheme_name}</div>
                    <p className="text-xs text-slate-600">{selectedChild.benefit_summary}</p>
                    <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Scheme Income Limit:</span>
                        <span className="font-mono font-bold">
                          &lt;= ₹{Number(selectedChild.income_threshold).toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Rule Provenance:</span>
                        <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                          {selectedChild.scheme_badge}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Application Status Card */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Application Journey Status
                      </span>
                      <Clock className="w-4 h-4 text-teal-700" />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-[#0f2942]">
                        {selectedChild.current_stage}
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-slate-600">
                        Owner: {selectedChild.stage_owner}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs space-y-1">
                      <div>
                        <span className="font-semibold text-slate-500">WHERE: </span>
                        <span className="text-slate-900">{selectedChild.where_is_it}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">WHY: </span>
                        <span className="text-slate-700">{selectedChild.why_here}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">NEXT ACTION: </span>
                        <span className="text-teal-900 font-medium">{selectedChild.next_action}</span>
                      </div>
                    </div>
                  </div>

                  {/* Child Evidence Passport Summary */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        Child Evidence Passport ({selectedChild.evidence.length} Items)
                      </span>
                      <Shield className="w-4 h-4 text-teal-700" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedChild.evidence.map((ev) => (
                        <div
                          key={ev.id}
                          className="border border-slate-200 rounded p-2.5 bg-slate-50 text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-[#0f2942] truncate">{ev.category}</span>
                            <span
                              className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                ev.verification_status === 'CONFLICT'
                                  ? 'bg-red-50 text-red-800 border-red-200'
                                  : 'bg-teal-50 text-teal-800 border-teal-200'
                              }`}
                            >
                              {ev.verification_status}
                            </span>
                          </div>
                          <div className="font-mono font-semibold text-slate-900">
                            {ev.claim_type === 'annual_income'
                              ? `₹${Number(ev.claim_value).toLocaleString('en-IN')}`
                              : ev.claim_type === 'institution_verified'
                              ? ev.claim_value === '1'
                                ? 'VERIFIED'
                                : 'UNVERIFIED'
                              : ev.claim_type === 'existing_scholarship_benefit'
                              ? ev.claim_value === '0'
                                ? 'None (0)'
                                : ev.claim_value
                              : ev.claim_value}
                          </div>
                          <div className="text-[10px] text-slate-500 truncate">
                            {ev.source} ({ev.document_reference})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Child Payment Status */}
                  <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-2.5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                        DBT Payment Status
                      </span>
                      <CreditCard className="w-4 h-4 text-teal-700" />
                    </div>
                    {selectedChild.payments.map((pay) => (
                      <div key={pay.id} className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#0f2942]">
                            {pay.payment_status} (₹{pay.amount.toLocaleString('en-IN')})
                          </span>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                            DEMO DATA
                          </span>
                        </div>
                        <div className="text-slate-600">
                          Sanction: <span className="font-mono font-semibold">{pay.sanction_status}</span> •
                          Updated: <span className="font-mono">{pay.last_updated}</span>
                        </div>
                        <div className="text-[11px] text-slate-500">Source: {pay.source}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && data && activeTab === 'scope' && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-teal-700" />
                <h2 className="text-sm font-bold text-[#0f2942]">
                  Guardian Role-Based Access Control (RBAC) Boundary
                </h2>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                STRICTLY SCOPED
              </span>
            </div>
            <ul className="space-y-2 text-xs text-slate-700">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span>
                  Authorized strictly for linked children in <code className="font-mono">guardian_student_links</code> ({data.linkedChildrenCount} linked records).
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span>
                  Unlinked student records and Officer Exception queues are blocked at both API and route guard layers.
                </span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span>
                  Each child&apos;s Evidence Passport and Application Journey remain separate and are never merged.
                </span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </PortalLayout>
  );
};
