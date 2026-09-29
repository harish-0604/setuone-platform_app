import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCheck,
  WifiOff,
  RotateCcw,
  Database,
  ExternalLink,
  CheckCircle2,
  Shield,
  Terminal,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { SetuOneLogoIcon, SetuOneWordmark } from '../components/brand/SetuOneLogo.tsx';

interface DemoStateSnapshot {
  databaseEngine: string;
  totalTables: number;
  tableCounts: Record<string, number>;
  outageActive: boolean;
  users: Array<Record<string, unknown>>;
  students: Array<Record<string, unknown>>;
  guardianLinks: Array<Record<string, unknown>>;
  schemes: Array<Record<string, unknown>>;
  evidence: Array<Record<string, unknown>>;
  conflicts: Array<Record<string, unknown>>;
  exceptions: Array<Record<string, unknown>>;
  applications: Array<Record<string, unknown>>;
  evaluations: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  adapters: Array<{ id: string; adapter_name: string; display_name: string; status: string; simulated_outcome: string }>;
  retryJobs: Array<Record<string, unknown>>;
  auditLogs: Array<Record<string, unknown>>;
  consentRecords: Array<Record<string, unknown>>;
}

export const PresenterPage: React.FC = () => {
  const { session, activatePresenterScenario, logout } = useAuth();
  const navigate = useNavigate();

  const [snapshot, setSnapshot] = useState<DemoStateSnapshot | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busyButton, setBusyButton] = useState<string | null>(null);
  const [inspectTab, setInspectTab] = useState<
    'personas' | 'evidence' | 'conflicts' | 'schemes' | 'audit' | 'tables'
  >('personas');

  const fetchStateSnapshot = useCallback(async () => {
    try {
      const res = await fetch('/api/demo/state');
      if (res.ok) {
        const data = (await res.json()) as DemoStateSnapshot;
        setSnapshot(data);
      }
    } catch {
      // Ignore transient error
    }
  }, []);

  useEffect(() => {
    fetchStateSnapshot();
  }, [fetchStateSnapshot]);

  const handlePersonaShortcut = async (
    key: string,
    endpoint: string,
    autoNavigate: boolean = false
  ) => {
    setBusyButton(key);
    setStatusMessage(null);
    try {
      const result = await activatePresenterScenario(endpoint);
      await fetchStateSnapshot();
      setStatusMessage(
        `Activated "${result.scenario}" -> Active session set to ${result.session.fullName} (${result.session.role.toUpperCase()}).`
      );
      if (autoNavigate) {
        navigate(result.redirectTo);
      }
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Failed to activate persona');
    } finally {
      setBusyButton(null);
    }
  };

  const handleToggleApiOutage = async () => {
    setBusyButton('outage');
    setStatusMessage(null);
    try {
      const res = await fetch('/api/demo/fault/api-outage', { method: 'POST' });
      const data = await res.json();
      await fetchStateSnapshot();
      setStatusMessage(data.message);
    } catch {
      setStatusMessage('Failed to toggle simulated API outage');
    } finally {
      setBusyButton(null);
    }
  };

  const handleResetDemo = async () => {
    setBusyButton('reset');
    setStatusMessage(null);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      await logout();
      await fetchStateSnapshot();
      setStatusMessage(data.message);
    } catch {
      setStatusMessage('Failed to reset demo database');
    } finally {
      setBusyButton(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900" data-testid="presenter-page">
      {/* 1. Narrow Top Government Strip */}
      <div className="bg-[#0f2942] text-slate-200 border-b border-slate-800 px-4 sm:px-6 py-1.5 text-[11px] font-medium">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span className="tracking-wide text-slate-100">
            Ministry of Tribal Affairs • Government of India
          </span>
          <span className="text-slate-300">
            National Unified Scholarship &amp; Resolution Platform
          </span>
        </div>
      </div>

      {/* 2. SetuOne Brand Header */}
      <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 shadow-2xs">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SetuOneLogoIcon className="w-11 h-9" />
            <div>
              <div className="flex items-center gap-2">
                <SetuOneWordmark className="text-lg" />
                <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                  /presenter • Evaluation Console
                </span>
              </div>
              <div className="text-[11px] text-slate-600 mt-0.5">
                Unified Scholarship Mobile &amp; Resolution Platform
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-semibold transition-colors cursor-pointer"
            >
              Open Login (/)
            </button>
            {session && (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    session.role === 'student'
                      ? '/student'
                      : session.role === 'guardian'
                      ? '/guardian'
                      : '/officer'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white font-semibold transition-colors cursor-pointer"
              >
                <span>Open Active Portal ({session.fullName})</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Header Description */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-teal-800">
              Hidden Presenter &amp; Judge Verification Mode (Direct URL Only)
            </div>
            <h1 className="text-lg font-bold text-[#0f2942]">
              Presenter Control Centre &amp; SQLite State Inspector
            </h1>
            <p className="text-xs text-slate-600">
              Accessible only via direct URL (/presenter). Use the 7 controls below to switch seeded personas, simulate service outages, reset the SQLite database, and inspect live state.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchStateSnapshot}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-800 shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh State</span>
          </button>
        </div>

        {statusMessage && (
          <div
            role="status"
            data-testid="presenter-status-banner"
            className="border border-teal-300 bg-teal-50 text-teal-950 rounded-lg px-4 py-3 text-xs flex items-center justify-between gap-4 shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
              <span className="font-medium">{statusMessage}</span>
            </div>
            {session && (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    session.role === 'student'
                      ? '/student'
                      : session.role === 'guardian'
                      ? '/guardian'
                      : '/officer'
                  )
                }
                className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-md shrink-0 cursor-pointer"
              >
                Open {session.role.toUpperCase()} Portal →
              </button>
            )}
          </div>
        )}

        {/* Section 7: Mandatory 7 Presenter Controls */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#0f2942]">
              7 Mandatory SIH Presenter Controls
            </h2>
            <span className="text-xs font-mono text-slate-500">
              Click button to activate persona session • Use arrow icon to jump directly to portal
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. MEENA — CLEAN CASE */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-teal-800 font-bold uppercase">
                  Student • Pre-Matric
                </div>
                <div className="font-bold text-sm text-[#0f2942]">Meena Murmu</div>
                <p className="text-xs text-slate-600">
                  Clean Case: All 6 evidence items verified. Income ₹1,20,000 (&lt;= ₹2,50,000). Straight-through processing.
                </p>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  data-testid="presenter-btn-meena"
                  disabled={busyButton === 'meena'}
                  onClick={() => handlePersonaShortcut('meena', '/api/demo/scenario/meena', false)}
                  className="flex-1 py-2 px-2.5 bg-[#0f2942] hover:bg-slate-800 text-white text-xs font-mono font-semibold rounded-md transition-colors cursor-pointer"
                >
                  MEENA — CLEAN CASE
                </button>
                <button
                  type="button"
                  title="Activate & Open Dashboard"
                  onClick={() => handlePersonaShortcut('meena', '/api/demo/scenario/meena', true)}
                  className="p-2 border border-slate-200 hover:bg-slate-100 rounded-md text-slate-700 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 2. ARJUN — INCOME CONFLICT */}
            <div className="bg-amber-50/40 border border-amber-300 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-amber-900 font-bold uppercase">
                  Student • Post-Matric
                </div>
                <div className="font-bold text-sm text-[#0f2942]">Arjun Murmu</div>
                <p className="text-xs text-slate-600">
                  Income Conflict: Profile ₹2,40,000 vs Certificate ₹2,80,000 straddling ₹2,50,000 threshold.
                </p>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  data-testid="presenter-btn-arjun"
                  disabled={busyButton === 'arjun'}
                  onClick={() => handlePersonaShortcut('arjun', '/api/demo/scenario/arjun', false)}
                  className="flex-1 py-2 px-2.5 bg-[#0f2942] hover:bg-slate-800 text-white text-xs font-mono font-semibold rounded-md transition-colors cursor-pointer"
                >
                  ARJUN — INCOME CONFLICT
                </button>
                <button
                  type="button"
                  title="Activate & Open Dashboard"
                  onClick={() => handlePersonaShortcut('arjun', '/api/demo/scenario/arjun', true)}
                  className="p-2 border border-slate-200 bg-white hover:bg-slate-100 rounded-md text-slate-700 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 3. LAKSHMI — ASSISTED ACCESS */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-teal-800 font-bold uppercase">
                  Student • CSC Assisted
                </div>
                <div className="font-bold text-sm text-[#0f2942]">Lakshmi Hembram</div>
                <p className="text-xs text-slate-600">
                  Assisted Access via CSC Khunti with recorded consent &amp; portable reference SETU-48291.
                </p>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  data-testid="presenter-btn-lakshmi"
                  disabled={busyButton === 'lakshmi'}
                  onClick={() => handlePersonaShortcut('lakshmi', '/api/demo/scenario/lakshmi', false)}
                  className="flex-1 py-2 px-2.5 bg-[#0f2942] hover:bg-slate-800 text-white text-xs font-mono font-semibold rounded-md transition-colors cursor-pointer"
                >
                  LAKSHMI — ASSISTED ACCESS
                </button>
                <button
                  type="button"
                  title="Activate & Open Dashboard"
                  onClick={() => handlePersonaShortcut('lakshmi', '/api/demo/scenario/lakshmi', true)}
                  className="p-2 border border-slate-200 hover:bg-slate-100 rounded-md text-slate-700 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 4. KAMALA — GUARDIAN */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-teal-800 font-bold uppercase">
                  Guardian • Linked Children
                </div>
                <div className="font-bold text-sm text-[#0f2942]">Kamala Devi</div>
                <p className="text-xs text-slate-600">
                  Guardian view linked strictly to Meena and Arjun only. Cannot view Lakshmi or unlinked records.
                </p>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  data-testid="presenter-btn-kamala"
                  disabled={busyButton === 'kamala'}
                  onClick={() => handlePersonaShortcut('kamala', '/api/demo/scenario/kamala', false)}
                  className="flex-1 py-2 px-2.5 bg-[#0f2942] hover:bg-slate-800 text-white text-xs font-mono font-semibold rounded-md transition-colors cursor-pointer"
                >
                  KAMALA — GUARDIAN
                </button>
                <button
                  type="button"
                  title="Activate & Open Dashboard"
                  onClick={() => handlePersonaShortcut('kamala', '/api/demo/scenario/kamala', true)}
                  className="p-2 border border-slate-200 hover:bg-slate-100 rounded-md text-slate-700 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 5. RAJESH — OFFICER */}
            <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-teal-800 font-bold uppercase">
                  Scholarship Officer
                </div>
                <div className="font-bold text-sm text-[#0f2942]">Rajesh Kumar</div>
                <p className="text-xs text-slate-600">
                  Officer Exception Command Centre. Assigned Arjun&apos;s open INCOME_CONFLICT review case.
                </p>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  data-testid="presenter-btn-rajesh"
                  disabled={busyButton === 'rajesh'}
                  onClick={() => handlePersonaShortcut('rajesh', '/api/demo/scenario/rajesh', false)}
                  className="flex-1 py-2 px-2.5 bg-[#0f2942] hover:bg-slate-800 text-white text-xs font-mono font-semibold rounded-md transition-colors cursor-pointer"
                >
                  RAJESH — OFFICER
                </button>
                <button
                  type="button"
                  title="Activate & Open Dashboard"
                  onClick={() => handlePersonaShortcut('rajesh', '/api/demo/scenario/rajesh', true)}
                  className="p-2 border border-slate-200 hover:bg-slate-100 rounded-md text-slate-700 cursor-pointer"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 6. API OUTAGE */}
            <div className="bg-amber-50/50 border border-amber-300 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-amber-900 font-bold uppercase">
                    Fault Injection
                  </span>
                  <span className="text-[10px] font-mono font-bold text-amber-950">
                    {snapshot?.outageActive ? 'OUTAGE ACTIVE' : 'OPERATIONAL'}
                  </span>
                </div>
                <div className="font-bold text-sm text-[#0f2942]">External Service Outage</div>
                <p className="text-xs text-slate-600">
                  Toggles CertificateAdapter &amp; PaymentAdapter to SERVICE_UNAVAILABLE and queues retry job.
                </p>
              </div>
              <button
                type="button"
                data-testid="presenter-btn-api-outage"
                disabled={busyButton === 'outage'}
                onClick={handleToggleApiOutage}
                className="w-full py-2 px-3 bg-amber-700 hover:bg-amber-800 text-white text-xs font-mono font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <WifiOff className="w-3.5 h-3.5" />
                <span>API OUTAGE</span>
              </button>
            </div>

            {/* 7. RESET DEMO */}
            <div className="bg-red-50/40 border border-red-200 rounded-lg p-3.5 shadow-2xs flex flex-col justify-between gap-3 sm:col-span-2">
              <div className="space-y-1">
                <div className="text-[10px] font-mono text-red-800 font-bold uppercase">
                  Idempotent Database Reset
                </div>
                <div className="font-bold text-sm text-[#0f2942]">
                  Restore Clean Baseline SQLite State
                </div>
                <p className="text-xs text-slate-600">
                  Drops and recreates all 24 SQLite tables and re-runs seed_data: restores Meena clean state, Arjun OPEN income conflict (₹2,40,000 vs ₹2,80,000), Lakshmi assisted state (SETU-48291), Kamala guardian links, and Officer queue.
                </p>
              </div>
              <button
                type="button"
                data-testid="presenter-btn-reset-demo"
                disabled={busyButton === 'reset'}
                onClick={handleResetDemo}
                className="w-full py-2 px-4 bg-red-700 hover:bg-red-800 text-white text-xs font-mono font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>RESET DEMO</span>
              </button>
            </div>
          </div>
        </section>

        {/* Active Session & RBAC Verification Bar */}
        <section className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-teal-700" />
              <span>Current sessionStorage Session</span>
            </div>
            {session ? (
              <div className="text-xs font-bold text-[#0f2942]">
                {session.fullName} ({session.role.toUpperCase()}) • <span className="font-mono">{session.demoId}</span>
              </div>
            ) : (
              <div className="text-xs font-semibold text-slate-500">No active session (Logged Out)</div>
            )}
            <div className="text-[11px] text-slate-500">
              Storage Key: <code className="font-mono">setuone_demo_session_v1</code>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-teal-700" />
              <span>SQLite Engine &amp; Schema</span>
            </div>
            <div className="text-xs font-bold text-[#0f2942] font-mono">
              {snapshot?.databaseEngine || 'SQLite (setuone.db)'} • {snapshot?.totalTables ?? 24} Tables
            </div>
            <div className="text-[11px] text-slate-500">
              All 24 core tables initialized
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-teal-700" />
              <span>Direct Route RBAC Test Links</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => navigate('/student')}
                className="px-2.5 py-1 text-xs font-mono bg-slate-50 border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
              >
                Test /student
              </button>
              <button
                type="button"
                onClick={() => navigate('/guardian')}
                className="px-2.5 py-1 text-xs font-mono bg-slate-50 border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
              >
                Test /guardian
              </button>
              <button
                type="button"
                onClick={() => navigate('/officer')}
                className="px-2.5 py-1 text-xs font-mono bg-slate-50 border border-slate-300 rounded hover:bg-slate-100 cursor-pointer"
              >
                Test /officer
              </button>
            </div>
          </div>
        </section>

        {/* Live Database State Inspector */}
        <section className="border border-slate-200 rounded-lg bg-white shadow-2xs overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-teal-700" />
              <h2 className="text-xs font-bold uppercase tracking-wide text-[#0f2942]">
                Live SQLite State Inspection Tools
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'personas', label: 'Personas & Links' },
                { id: 'conflicts', label: 'Conflicts & Exceptions' },
                { id: 'evidence', label: `Evidence (${snapshot?.evidence?.length ?? 0})` },
                { id: 'schemes', label: `Schemes & Rules (${snapshot?.schemes?.length ?? 0})` },
                { id: 'audit', label: `Audit Trail (${snapshot?.auditLogs?.length ?? 0})` },
                { id: 'tables', label: `24 SQLite Tables` },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setInspectTab(t.id as typeof inspectTab)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                    inspectTab === t.id
                      ? 'bg-[#0f2942] text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {inspectTab === 'personas' && snapshot && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                    Seeded Users &amp; Student Profiles (5 Personas)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pr-4">User ID</th>
                          <th className="py-2 px-4">Full Name</th>
                          <th className="py-2 px-4">Role</th>
                          <th className="py-2 px-4">Demo Identifier</th>
                          <th className="py-2 pl-4">Simulated Auth Method</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {snapshot.users.map((u, idx) => (
                          <tr key={idx}>
                            <td className="py-2 pr-4 font-semibold text-slate-900">{String(u.id)}</td>
                            <td className="py-2 px-4 font-sans font-semibold text-[#0f2942]">{String(u.full_name)}</td>
                            <td className="py-2 px-4 uppercase text-teal-800">{String(u.role)}</td>
                            <td className="py-2 px-4">{String(u.demo_id)} ({String(u.mobile)})</td>
                            <td className="py-2 pl-4 font-sans text-slate-600">{String(u.auth_method_label)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                    Guardian-Student Links (Kamala Devi → Meena &amp; Arjun Only)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {snapshot.guardianLinks.map((g, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-md p-3 bg-slate-50 text-xs flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-900">{String(g.guardian_name)}</span>
                          <span className="mx-2 text-slate-400">→</span>
                          <span className="font-semibold text-teal-800">{String(g.student_name)}</span>
                        </div>
                        <span className="font-mono text-slate-500">{String(g.student_id)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {inspectTab === 'conflicts' && snapshot && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Active Conflicts &amp; Exceptions (Arjun Straddling ₹2,50,000 Threshold)
                </h3>
                {snapshot.exceptions.map((ex, idx) => (
                  <div key={idx} className="border border-amber-300 bg-amber-50/40 rounded-lg p-3.5 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-amber-950">
                        Exception ID: {String(ex.id)} • Type: {String(ex.type)}
                      </span>
                      <span className="px-2 py-0.5 bg-amber-200/70 text-amber-950 rounded font-bold">
                        Status: {String(ex.status)}
                      </span>
                    </div>
                    <p className="text-slate-800 font-medium">{String(ex.problem_summary)}</p>
                    <div className="text-slate-600 font-mono">
                      Affected Rule: {String(ex.affected_rule)} ({String(ex.rule_version)}) • Owner: {String(ex.owner)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {inspectTab === 'evidence' && snapshot && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3">ID</th>
                      <th className="py-2 px-3">Student</th>
                      <th className="py-2 px-3">Category</th>
                      <th className="py-2 px-3">Claim Value</th>
                      <th className="py-2 px-3">Source</th>
                      <th className="py-2 pl-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {snapshot.evidence.map((ev, idx) => (
                      <tr key={idx}>
                        <td className="py-2 pr-3 text-slate-700">{String(ev.id)}</td>
                        <td className="py-2 px-3 text-slate-900">{String(ev.student_id)}</td>
                        <td className="py-2 px-3 font-sans">{String(ev.category)}</td>
                        <td className="py-2 px-3 font-bold text-slate-900">{String(ev.claim_value)}</td>
                        <td className="py-2 px-3 font-sans text-slate-600">{String(ev.source)}</td>
                        <td className="py-2 pl-3 text-right font-bold">
                          <span
                            className={
                              ev.verification_status === 'CONFLICT'
                                ? 'text-amber-800'
                                : 'text-teal-700'
                            }
                          >
                            {String(ev.verification_status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {inspectTab === 'schemes' && snapshot && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {snapshot.schemes.map((s, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-lg p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-xs text-[#0f2942]">{String(s.name)}</div>
                      <span className="text-[10px] font-mono text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        {String(s.badge_text)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">{String(s.description)}</p>
                    <div className="text-xs font-mono text-slate-800">
                      Prototype Income Threshold: ₹{Number(s.income_threshold).toLocaleString('en-IN')} • Version: {String(s.active_rule_version)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500">
                      Status: {String(s.validation_status)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {inspectTab === 'audit' && snapshot && (
              <div className="space-y-2">
                {snapshot.auditLogs.map((log, idx) => (
                  <div
                    key={idx}
                    className="border border-slate-200 rounded-md p-2.5 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
                  >
                    <div>
                      <span className="text-slate-500 mr-2">[{String(log.timestamp)}]</span>
                      <span className="font-bold text-[#0f2942] mr-2">{String(log.actor)}:</span>
                      <span className="font-sans font-medium text-slate-800">{String(log.action)}</span>
                    </div>
                    <div className="text-slate-600">
                      {String(log.before_state)} → <strong className="text-teal-800">{String(log.after_state)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {inspectTab === 'tables' && snapshot && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {Object.entries(snapshot.tableCounts).map(([tableName, count]) => (
                  <div
                    key={tableName}
                    className="border border-slate-200 rounded-md p-2.5 bg-slate-50 flex items-center justify-between text-xs font-mono"
                  >
                    <span className="text-slate-700 truncate">{tableName}</span>
                    <span className="font-bold text-teal-800 ml-2 tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};
