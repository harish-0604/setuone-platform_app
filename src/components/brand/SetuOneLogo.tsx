import React from 'react';

/**
 * Faithful vector SVG recreation of the official SetuOne logo:
 * - Open book at the base (teal upper pages + dark navy lower pages)
 * - Left saffron/amber circular bridge arc
 * - Right green-to-teal circular bridge arc with three rising leaves
 * - Two rising student figures at center:
 *   - Left dark-navy graduate figure with mortarboard cap and tassel
 *   - Right green-teal rising student figure
 */
export const SetuOneLogoIcon: React.FC<{ className?: string }> = ({ className = 'w-10 h-10' }) => (
  <svg
    viewBox="0 0 240 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} shrink-0 select-none`}
    role="img"
    aria-label="SetuOne Emblem"
  >
    <defs>
      <linearGradient id="setu-arc-left" x1="40" y1="150" x2="130" y2="18" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#ea6a15" />
        <stop offset="55%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#fbbf24" />
      </linearGradient>
      <linearGradient id="setu-arc-right" x1="115" y1="16" x2="195" y2="150" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#72c95b" />
        <stop offset="50%" stopColor="#14a87a" />
        <stop offset="100%" stopColor="#0a6c74" />
      </linearGradient>
      <linearGradient id="setu-student-navy" x1="85" y1="45" x2="125" y2="165" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#072c59" />
        <stop offset="65%" stopColor="#0a417a" />
        <stop offset="100%" stopColor="#0d5c91" />
      </linearGradient>
      <linearGradient id="setu-student-green" x1="155" y1="75" x2="122" y2="165" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#5ec85a" />
        <stop offset="55%" stopColor="#129c78" />
        <stop offset="100%" stopColor="#0b7275" />
      </linearGradient>
      <linearGradient id="setu-page-left" x1="35" y1="145" x2="118" y2="175" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#169db2" />
        <stop offset="100%" stopColor="#0d7489" />
      </linearGradient>
      <linearGradient id="setu-page-right" x1="122" y1="175" x2="205" y2="145" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0d7a78" />
        <stop offset="100%" stopColor="#12998a" />
      </linearGradient>
    </defs>

    {/* Outer Left Thin Orange Accent Swoosh */}
    <path
      d="M52 146C34 114 40 68 68 42C50 68 44 108 58 142Z"
      fill="#ea6a15"
    />

    {/* Left Saffron-Gold Crescent Arc */}
    <path
      d="M58 143C43 108 54 60 88 36C106 23 128 20 144 26C124 24 102 31 86 46C64 67 57 101 74 127C81 131 90 135 100 137L67 137L58 143Z"
      fill="url(#setu-arc-left)"
    />

    {/* Right Green-to-Teal Crescent Arc */}
    <path
      d="M114 17C142 15 166 28 180 49C176 41 171 54 168 64C155 42 136 26 114 17Z"
      fill="url(#setu-arc-right)"
    />
    <path
      d="M179 98C185 114 184 132 176 146L185 137C192 120 192 98 184 82C182 88 180 93 179 98Z"
      fill="#0a6c74"
    />

    {/* Three Leaves on the Right Arc */}
    {/* Leaf 1 (Upper large leaf) */}
    <path
      d="M171 39C186 48 190 66 181 82C179 69 175 59 167 52C169 59 173 69 174 83C162 72 160 53 171 39Z"
      fill="url(#setu-arc-right)"
    />
    {/* Leaf 2 (Middle right leaf) */}
    <path
      d="M197 65C198 79 191 90 178 95C182 86 186 79 192 74C186 77 180 83 176 91C175 78 184 67 197 65Z"
      fill="url(#setu-arc-right)"
    />

    {/* Center Left Figure — Navy Graduate */}
    {/* Mortarboard Cap */}
    <polygon
      points="83,51 115,37 146,48 114,61"
      fill="#072c59"
    />
    {/* Tassel on left */}
    <path
      d="M91 53V68C89 69 89 74 91 75C93 74 93 69 91 68"
      stroke="#072c59"
      strokeWidth="3.2"
      strokeLinecap="round"
    />
    <circle cx="91" cy="73" r="2.8" fill="#072c59" />

    {/* Navy Graduate Head */}
    <circle cx="116" cy="69" r="14.5" fill="#072c59" />

    {/* Navy Graduate Body & Raised Right Arm */}
    <path
      d="M66 91C86 84 108 91 120 112C122 97 135 67 153 47C146 73 136 99 128 124C125 137 122 152 119 164C111 135 96 102 66 91Z"
      fill="url(#setu-student-navy)"
    />

    {/* Center Right Figure — Green/Teal Student */}
    <circle cx="149" cy="87" r="11" fill="#4bc063" />
    <path
      d="M122 162C123 134 130 112 146 105C157 100 166 90 173 76C172 97 162 115 147 127C136 136 128 148 122 162Z"
      fill="url(#setu-student-green)"
    />

    {/* Base Open Book — Upper Teal Pages */}
    <path
      d="M42 156L67 137C88 137 107 146 119 166C101 153 74 149 42 156Z"
      fill="url(#setu-page-left)"
    />
    <path
      d="M198 156L173 137C152 137 133 146 121 166C139 153 166 149 198 156Z"
      fill="url(#setu-page-right)"
    />

    {/* Base Open Book — Lower Dark Navy Spine/Cover */}
    <path
      d="M30 171L43 159C73 154 100 160 120 178C140 160 167 154 197 159L210 171C176 164 145 170 120 190C95 170 64 164 30 171Z"
      fill="#072c59"
    />
  </svg>
);

/**
 * Two-tone SetuOne wordmark ("Setu" in deep navy #072c59, "One" in teal #0b8478)
 */
export const SetuOneWordmark: React.FC<{ className?: string }> = ({ className = 'text-lg' }) => (
  <span className={`font-extrabold tracking-tight leading-none ${className}`}>
    <span className="text-[#072c59]">Setu</span>
    <span className="text-[#0b8478]">One</span>
  </span>
);

/**
 * Full Centered Brand Lockup used on the Login Screen (matching the uploaded reference logo)
 */
export const SetuOneHeroLockup: React.FC = () => (
  <div className="text-center space-y-1.5 select-none">
    <div className="flex justify-center">
      <SetuOneLogoIcon className="w-28 h-24 sm:w-32 sm:h-28" />
    </div>
    <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-none">
      <span className="text-[#072c59]">Setu</span>
      <span className="text-[#0b8478]">One</span>
    </h1>
    <p className="text-xs sm:text-sm font-medium text-[#243b53]">
      Unified Scholarship Mobile &amp; Resolution Platform
    </p>
    <div className="flex items-center justify-center gap-2.5 pt-0.5">
      <span className="h-px w-8 sm:w-12 bg-slate-300" />
      <p className="text-[11px] sm:text-xs font-semibold">
        <span className="text-[#072c59]">One Scholarship Journey. </span>
        <span className="text-[#0b8478]">One Trusted Bridge.</span>
      </p>
      <span className="h-px w-8 sm:w-12 bg-slate-300" />
    </div>
  </div>
);
