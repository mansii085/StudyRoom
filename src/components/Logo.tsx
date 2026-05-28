import { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <defs>
        <linearGradient id="hexGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop stopColor="#818CF8" />
          <stop offset="1" stopColor="#c084fc" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background glow layer */}
      <path d="M12 2L21 7.19615V16.8038L12 22L3 16.8038V7.19615L12 2Z" stroke="url(#hexGrad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3" filter="url(#glow)"/>

      {/* Main Hexagon */}
      <path d="M12 2L21 7.19615V16.8038L12 22L3 16.8038V7.19615L12 2Z" stroke="url(#hexGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      
      {/* Network lines inside */}
      <path d="M12 2L12 12" stroke="url(#hexGrad)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M21 16.8038L12 12" stroke="url(#hexGrad)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 16.8038L12 12" stroke="url(#hexGrad)" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      
      {/* Secondary Web Lines */}
      <path d="M12 22L12 12" stroke="url(#hexGrad)" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5"/>
      <path d="M21 7.19615L12 12" stroke="url(#hexGrad)" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5"/>
      <path d="M3 7.19615L12 12" stroke="url(#hexGrad)" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.5"/>

      {/* Nodes */}
      <circle cx="12" cy="12" r="1.5" fill="#fff" filter="url(#glow)"/>
      <circle cx="12" cy="2" r="1.5" fill="#c084fc"/>
      <circle cx="21" cy="16.8038" r="1.5" fill="#818CF8"/>
      <circle cx="3" cy="16.8038" r="1.5" fill="#818CF8"/>
      <circle cx="12" cy="22" r="1" fill="#c084fc" opacity="0.8"/>
      <circle cx="21" cy="7.19615" r="1" fill="#818CF8" opacity="0.8"/>
      <circle cx="3" cy="7.19615" r="1" fill="#818CF8" opacity="0.8"/>
    </svg>
  );
}
