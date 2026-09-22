import React from 'react';

interface CyberShieldLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export const CyberShieldLogo: React.FC<CyberShieldLogoProps> = ({ size = 28, className = '', ...props }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="shieldGrad" x1="8" y1="4" x2="40" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B7EF8" stopOpacity="0.8" />
          <stop offset="0.5" stopColor="#6366F1" stopOpacity="0.4" />
          <stop offset="1" stopColor="#10B981" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="glowConduit" x1="16" y1="16" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8B7EF8" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
      </defs>

      {/* Cyber Shield Outer Contour */}
      <path
        d="M24 3.5L41 9.5V23C41 33.2 33.5 41.5 24 44.5C14.5 41.5 7 33.2 7 23V9.5L24 3.5Z"
        fill="#0D0D12"
        stroke="url(#shieldGrad)"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Inner Tactical Shield Inset */}
      <path
        d="M24 7.5L37 12V22.5C37 30.5 31.2 37.5 24 40C16.8 37.5 11 30.5 11 22.5V12L24 7.5Z"
        stroke="#1F1F2A"
        strokeWidth="1.2"
        strokeDasharray="2 3"
      />

      {/* Dual Vector Conduits */}
      {/* Dense Vector Branch (Left to Center) */}
      <line x1="16" y1="18" x2="24" y2="24" stroke="url(#glowConduit)" strokeWidth="1.8" />
      {/* Sparse Vector Branch (Right to Center) */}
      <line x1="32" y1="18" x2="24" y2="24" stroke="#F59E0B" strokeWidth="1.8" strokeOpacity="0.85" />
      {/* Fusion Grounding Conduit (Center to Bottom) */}
      <line x1="24" y1="24" x2="24" y2="34" stroke="#10B981" strokeWidth="2" />

      {/* Node 1: Dense Vector Node (Iris Violet) */}
      <circle cx="16" cy="18" r="3" fill="#8B7EF8" />
      <circle cx="16" cy="18" r="4.5" stroke="#8B7EF8" strokeWidth="0.8" strokeOpacity="0.5" />

      {/* Node 2: Sparse Vector Node (Amber) */}
      <circle cx="32" cy="18" r="3" fill="#F59E0B" />
      <circle cx="32" cy="18" r="4.5" stroke="#F59E0B" strokeWidth="0.8" strokeOpacity="0.5" />

      {/* Core Node: Fusion RRF / Grounding Core (Emerald) */}
      <circle cx="24" cy="24" r="3.5" fill="#10B981" />
      <circle cx="24" cy="24" r="5.5" stroke="#10B981" strokeWidth="1" strokeOpacity="0.6" />

      {/* Target Node: Synthesized Evidence */}
      <circle cx="24" cy="34" r="2.2" fill="#F4F4F6" />
    </svg>
  );
};
