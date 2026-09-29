import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, ArrowRight, CheckCircle2, Building2, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { UserRole } from '../types/index.ts';
import { getRoleDashboardPath } from '../components/auth/RoleGuard.tsx';
import { SetuOneLogoIcon, SetuOneWordmark, SetuOneHeroLockup } from '../components/brand/SetuOneLogo.tsx';

const ROLE_CONFIG: Record<
  UserRole,
  {
    tabLabel: string;
    methodTitle: string;
    identifierLabel: string;
    defaultIdentifier: string;
    identifierPlaceholder: string;
    otpLabel: string;
    helperText: string;
    simulationNote: string;
  }
> = {
  student: {
    tabLabel: 'Student',
    methodTitle: 'Demo Mobile OTP / Simulated Locker Login',
    identifierLabel: 'Mobile Number or Application Reference ID',
    defaultIdentifier: '9876500002',
    identifierPlaceholder: 'e.g. 9876500002 or SETU-20841',
    otpLabel: 'Simulated 6-Digit OTP',
    helperText: 'Demo IDs: 9876500002 (Income Conflict) • 9876500001 (Clean) • SETU-48291 (Assisted) | OTP: 123456',
    simulationNote:
      'Simulated student sign-in. Not connected to live Aadhaar, DigiLocker, or MeriPehchan.',
  },
  guardian: {
    tabLabel: 'Guardian',
    methodTitle: 'Demo Guardian Mobile OTP',
    identifierLabel: 'Registered Guardian Mobile Number',
    defaultIdentifier: '9876500010',
    identifierPlaceholder: 'e.g. 9876500010',
    otpLabel: 'Simulated 6-Digit OTP',
    helperText: 'Demo Guardian Mobile: 9876500010 | Simulated OTP: 123456',
    simulationNote:
      'Simulated guardian sign-in to view linked family scholarship records only.',
  },
  officer: {
    tabLabel: 'Officer SSO',
    methodTitle: 'Demo Government Officer SSO',
    identifierLabel: 'Officer Employee ID / SSO Handle',
    defaultIdentifier: 'OFF-2026-TRIBAL',
    identifierPlaceholder: 'e.g. OFF-2026-TRIBAL',
    otpLabel: 'Simulated SSO Security Passkey',
    helperText: 'Demo Officer SSO Handle configured | Passkey: 123456',
    simulationNote:
      'Simulated Scholarship Officer Single Sign-On. Not connected to live Jan Parichay.',
  },
};

export const LoginPage: React.FC = () => {
  const { session, loginWithSimulatedCredentials, loading } = useAuth();
  const navigate = useNavigate();

  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [identifier, setIdentifier] = useState<string>(ROLE_CONFIG.student.defaultIdentifier);
  const [otp, setOtp] = useState<string>('123456');
  const [otpRequested, setOtpRequested] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      navigate(getRoleDashboardPath(session.role), { replace: true });
    }
  }, [session, navigate]);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setIdentifier(ROLE_CONFIG[role].defaultIdentifier);
    setOtp('123456');
    setOtpRequested(true);
    setError(null);
  };

  const handleSendSimulatedOtp = () => {
    setOtp('123456');
    setOtpRequested(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const authenticated = await loginWithSimulatedCredentials({
        role: selectedRole,
        identifier,
        otp,
      });
      navigate(getRoleDashboardPath(authenticated.role), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulated login failed');
    }
  };

  const activeConfig = ROLE_CONFIG[selectedRole];

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900">
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
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SetuOneLogoIcon className="w-11 h-9" />
            <div>
              <SetuOneWordmark className="text-lg" />
              <div className="text-[11px] text-slate-600 mt-0.5">
                Unified Scholarship Mobile &amp; Resolution Platform
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-semibold uppercase tracking-wide px-2.5 py-1 rounded bg-teal-50 text-teal-800 border border-teal-200">
              Demo Environment
            </span>
          </div>
        </div>
      </header>

      {/* 3. Centered Login Viewport */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-5">
          {/* Centered Brand Identity Header */}
          <SetuOneHeroLockup />

          {/* Centered Login Card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-[#0f2942]">Portal Sign In</h2>
                <p className="text-[11px] text-slate-500">
                  Simulated authentication for SIH prototype evaluation
                </p>
              </div>
              <span className="text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                Demo Environment
              </span>
            </div>

            {/* Role Selector Tabs: Student | Guardian | Officer SSO */}
            <div
              role="tablist"
              aria-label="Select portal role"
              className="grid grid-cols-3 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-md"
            >
              {(['student', 'guardian', 'officer'] as UserRole[]).map((role) => {
                const isActive = selectedRole === role;
                return (
                  <button
                    key={role}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    data-testid={`role-tab-${role}`}
                    onClick={() => handleRoleSelect(role)}
                    className={`py-1.5 px-2 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#0f2942] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {ROLE_CONFIG[role].tabLabel}
                  </button>
                );
              })}
            </div>

            {/* Simulated Method Strip */}
            <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2 space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0f2942]">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span>{activeConfig.methodTitle}</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                {activeConfig.simulationNote}
              </p>
            </div>

            {/* Compact Login Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label
                  htmlFor="login-identifier"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  {activeConfig.identifierLabel}
                </label>
                <input
                  id="login-identifier"
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={activeConfig.identifierPlaceholder}
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="login-otp" className="block text-xs font-semibold text-slate-700">
                    {activeConfig.otpLabel}
                  </label>
                  <button
                    type="button"
                    onClick={handleSendSimulatedOtp}
                    className="text-[11px] font-semibold text-teal-700 hover:text-teal-800 underline cursor-pointer"
                  >
                    Resend Simulated OTP
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="login-otp"
                    type="text"
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="6-digit simulated OTP"
                    className="w-full px-3 py-2 text-xs font-mono tracking-widest bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700 focus:border-teal-700"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                </div>
                {otpRequested && (
                  <p className="mt-1 text-[11px] text-teal-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-teal-700 shrink-0" />
                    <span>Simulated OTP pre-filled (123456)</span>
                  </p>
                )}
              </div>

              {/* Subtle helper text & clickable demo ID chips for development/testing */}
              <div className="text-[10px] font-mono text-slate-500 bg-slate-50 border border-slate-200 rounded px-2.5 py-2 space-y-1.5">
                <div>{activeConfig.helperText}</div>
                {selectedRole === 'student' && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {[
                      { id: '9876500002', label: '9876500002 (Conflict Case)' },
                      { id: '9876500001', label: '9876500001 (Clean Case)' },
                      { id: 'SETU-48291', label: 'SETU-48291 (Assisted CSC)' },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setIdentifier(opt.id)}
                        className={`px-2 py-0.5 rounded border text-[10px] font-semibold transition-colors cursor-pointer ${
                          identifier === opt.id
                            ? 'bg-[#0f2942] text-white border-[#0f2942]'
                            : 'bg-white text-slate-700 border-slate-300 hover:border-teal-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-2.5 rounded-md bg-red-50 border border-red-200 text-xs text-red-800 font-medium"
                >
                  {error}
                </div>
              )}

              {/* Teal Primary Button */}
              <button
                type="submit"
                disabled={loading}
                data-testid="login-submit-button"
                className="w-full py-2.5 px-4 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <span>
                  {loading
                    ? 'Verifying Simulated Session...'
                    : `Sign In to ${activeConfig.tabLabel} Portal`}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Two Small Secondary Cards Below Login Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0f2942]">
                <Building2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span>Assisted Access (CSC)</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Students applying via Gram Panchayat / CSC receive a portable tracking token (e.g.{' '}
                <span className="font-mono font-semibold text-slate-800">SETU-48291</span>) with recorded consent.
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0f2942]">
                <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Prototype Notice</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Simulated session state (<span className="font-mono">sessionStorage</span>). No live Aadhaar, DigiLocker, or official government SSO integration.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Restrained Government Portal Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 sm:px-6 py-3 text-[11px] text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SetuOne • Unified Scholarship Mobile &amp; Resolution Platform</span>
          <span>Support: Demo Helpdesk • Core Flow: Detect → Explain → Assign → Resolve → Re-evaluate → Continue</span>
        </div>
      </footer>
    </div>
  );
};
