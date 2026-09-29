import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ShieldAlert, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { useLanguage } from '../contexts/LanguageContext.tsx';
import { SetuOneLogoIcon, SetuOneWordmark } from '../components/brand/SetuOneLogo.tsx';
import { LanguageSelector } from '../components/brand/LanguageSelector.tsx';

export { SetuOneLogoIcon, SetuOneWordmark };

interface PortalLayoutProps {
  portalLabel: string;
  navItems?: Array<{ id: string; label: string; active?: boolean; onClick?: () => void }>;
  children: React.ReactNode;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export const PortalLayout: React.FC<PortalLayoutProps> = ({
  portalLabel,
  navItems = [],
  children,
}) => {
  const { session, logout, accessDeniedNotice, setAccessDeniedNotice } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] text-slate-900">
      <div className="sticky top-0 z-30 shadow-2xs">
        {/* 1. Narrow Top Government Strip with Multilingual Switcher */}
        <div className="bg-[#0f2942] text-slate-200 border-b border-slate-800 px-4 sm:px-6 py-1.5 text-[11px] font-medium">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="tracking-wide text-slate-100">
                {t('Ministry of Tribal Affairs • Government of India')}
              </span>
              <span className="hidden md:inline text-slate-500">|</span>
              <span className="hidden sm:inline text-slate-300">
                {t('National Unified Scholarship & Resolution Platform')}
              </span>
            </div>
            <LanguageSelector variant="dark" />
          </div>
        </div>

        {/* 2. SetuOne Brand Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Left: SetuOne Logo + Name + Subtitle */}
          <a href="/" className="flex items-center gap-3 group">
            <SetuOneLogoIcon className="w-11 h-9" />
            <div>
              <div className="flex items-center gap-2">
                <SetuOneWordmark className="text-xl" />
                <span className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  {t('Demo Environment')}
                </span>
              </div>
              <div className="text-xs text-slate-600 mt-0.5">
                {t('Unified Scholarship Mobile & Resolution Platform')}
              </div>
            </div>
          </a>

          {/* Right: Authenticated User Card (Avatar, Name, Role Badge, Sign Out) */}
          {session && (
            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <div className="w-8 h-8 rounded-full bg-[#0f2942] text-teal-300 text-xs font-bold flex items-center justify-center shrink-0">
                {getInitials(session.fullName)}
              </div>
              <div className="leading-tight pr-1">
                <div className="text-xs font-bold text-slate-900">{session.fullName}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-wide text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.2 rounded">
                    {t(portalLabel)}
                  </span>
                </div>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <button
                type="button"
                onClick={handleSignOut}
                data-testid="sign-out-button"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors whitespace-nowrap cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t('Sign Out')}</span>
              </button>
            </div>
          )}
        </div>
      </header>
      </div>

      {/* Optional Horizontal Navigation Tabs Strip if provided by page */}
      {navItems.length > 0 && (
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto flex items-center gap-1 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                data-testid={`nav-tab-${item.id}`}
                onClick={item.onClick}
                className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                  item.active
                    ? 'border-teal-700 text-teal-800 bg-teal-50/40'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
                }`}
              >
                {t(item.label)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RBAC Route Restriction Alert if user attempted unauthorized role URL */}
      {accessDeniedNotice && (
        <div
          role="alert"
          data-testid="rbac-denied-banner"
          className="bg-amber-50 border-b border-amber-300 px-4 sm:px-6 py-2.5"
        >
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4 text-xs text-amber-950">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
              <span className="font-medium">{accessDeniedNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setAccessDeniedNotice(null)}
              className="p-1 text-amber-800 hover:text-amber-950 rounded cursor-pointer"
              aria-label="Dismiss alert"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>

      {/* Restrained Government Portal Footer */}
      <footer className="border-t border-slate-200 bg-white px-4 sm:px-6 py-3.5 text-[11px] text-slate-500">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <span className="font-semibold text-slate-700">SetuOne</span>
            <span className="mx-1.5">•</span>
            <span>Unified Scholarship Mobile &amp; Resolution Platform</span>
            <span className="mx-1.5">•</span>
            <span>Simulated Prototype Session (No Live Aadhaar / DigiLocker / NSP / PFMS Connection)</span>
          </div>
          <div className="text-slate-500">
            <span>Assistance: Demo Helpdesk</span>
            <span className="mx-1.5">•</span>
            <span className="font-mono">DEMO — PENDING OFFICIAL GUIDELINE VALIDATION</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
