import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage, SupportedLanguage } from '../../contexts/LanguageContext.tsx';

interface LanguageSelectorProps {
  variant?: 'dark' | 'light';
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ variant = 'dark' }) => {
  const { language, setLanguage, languages } = useLanguage();

  return (
    <div
      data-testid="language-selector"
      data-no-translate="true"
      translate="no"
      className="notranslate flex flex-wrap items-center gap-1.5"
    >
      <span
        className={`inline-flex items-center gap-1 text-[11px] font-semibold tracking-wide ${
          variant === 'dark' ? 'text-teal-300' : 'text-teal-800'
        }`}
      >
        <Globe className="w-3.5 h-3.5 shrink-0" />
        <span>Language:</span>
      </span>

      {/* Instant 1-Click Language Pill Buttons showing BOTH English & Native Script */}
      <div className="flex flex-wrap items-center gap-1">
        {languages.map((lang) => {
          const isActive = language === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              data-testid={`lang-btn-${lang.code}`}
              onClick={() => setLanguage(lang.code as SupportedLanguage)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-none cursor-pointer border ${
                variant === 'dark'
                  ? isActive
                    ? 'bg-teal-600 text-white border-teal-300 shadow-2xs'
                    : 'bg-slate-800/90 text-slate-200 border-slate-700 hover:bg-slate-700 hover:text-white'
                  : isActive
                  ? 'bg-[#0f2942] text-white border-[#0f2942]'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:border-teal-700'
              }`}
            >
              {lang.displayLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
};
