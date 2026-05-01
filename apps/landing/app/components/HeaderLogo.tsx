export default function HeaderLogo() {
  return (
    <span className="brand-logo-mark shrink-0" aria-hidden="true">
      <svg className="header-logo-image" viewBox="0 0 128 128" role="img" focusable="false" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="pcOuter" x1="18" y1="12" x2="110" y2="120" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0B7B60" />
            <stop offset="0.48" stopColor="#064332" />
            <stop offset="1" stopColor="#02110D" />
          </linearGradient>
          <linearGradient id="pcPanel" x1="34" y1="24" x2="98" y2="104" gradientUnits="userSpaceOnUse">
            <stop stopColor="#142B27" />
            <stop offset="0.52" stopColor="#061C17" />
            <stop offset="1" stopColor="#020B09" />
          </linearGradient>
          <linearGradient id="pcChrome" x1="20" y1="18" x2="112" y2="108" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.24" stopColor="#A9B8B0" />
            <stop offset="0.52" stopColor="#EDF5F0" />
            <stop offset="0.78" stopColor="#76847E" />
            <stop offset="1" stopColor="#F7FBF8" />
          </linearGradient>
          <linearGradient id="pcLeftMetal" x1="34" y1="31" x2="66" y2="83" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="0.55" stopColor="#F3F1EA" />
            <stop offset="1" stopColor="#C7C5BC" />
          </linearGradient>
          <linearGradient id="pcRightMetal" x1="80" y1="31" x2="104" y2="103" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C9CDC7" />
            <stop offset="0.46" stopColor="#8D928B" />
            <stop offset="1" stopColor="#656C65" />
          </linearGradient>
          <linearGradient id="pcMint" x1="18" y1="96" x2="98" y2="54" gradientUnits="userSpaceOnUse">
            <stop stopColor="#9DFFE0" />
            <stop offset="0.48" stopColor="#68EFC1" />
            <stop offset="1" stopColor="#8CFFD6" />
          </linearGradient>
          <filter id="pcSoftShadow" x="-25%" y="-25%" width="150%" height="150%">
            <feDropShadow dx="0" dy="9" stdDeviation="8" floodColor="#000000" floodOpacity="0.38" />
          </filter>
          <filter id="pcHardShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="2" floodColor="#000000" floodOpacity="0.42" />
          </filter>
        </defs>

        <rect x="7" y="7" width="114" height="114" rx="31" fill="url(#pcOuter)" filter="url(#pcSoftShadow)" />
        <rect x="23" y="22" width="82" height="82" rx="21" fill="url(#pcChrome)" opacity="0.96" />
        <rect x="26" y="25" width="76" height="76" rx="18" fill="#071A15" />
        <rect x="29" y="28" width="70" height="70" rx="15" fill="url(#pcPanel)" />
        <path d="M31 30.5C41.5 26.4 80.5 25.2 96 31.5C89 27.2 47.5 27.1 31 30.5Z" fill="#FFFFFF" opacity="0.12" />
        <path d="M31 93C48 99.4 84.8 99.4 96.5 92.7" stroke="#FFFFFF" strokeOpacity="0.11" strokeWidth="2" />

        <g filter="url(#pcHardShadow)">
          <path d="M40 39H66V78L58 86V50H49V90H40V39Z" fill="url(#pcLeftMetal)" />
          <path d="M80 39H91V83H103V94H69V83H80V39Z" fill="url(#pcRightMetal)" />
          <path d="M69 83H80V68H91V94H69V83Z" fill="#737A72" />
          <path d="M64 74L58 80V86L66 78V74H64Z" fill="#F7F6F0" opacity="0.85" />
        </g>

        <path d="M17 101C25 91 30 90 37 90H48C52 90 55 89 58 85L67 74C70 70 73 69 78 69H82C86 69 88 68 91 64L99 55" fill="none" stroke="#0B211B" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" opacity="0.62" />
        <path d="M17 100C25 91 30 90 37 90H48C52 90 55 89 58 85L67 74C70 70 73 69 78 69H82C86 69 88 68 91 64L99 55" fill="none" stroke="url(#pcMint)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18 100C26 91.7 31 91 38 91H49" fill="none" stroke="#D8FFF2" strokeWidth="2" strokeLinecap="round" opacity="0.45" />
        <circle cx="99" cy="55" r="10" fill="#061A15" stroke="#0A2E25" strokeWidth="2" />
        <circle cx="99" cy="55" r="6.7" fill="url(#pcMint)" />
        <circle cx="96.5" cy="52" r="2.2" fill="#E5FFF6" opacity="0.55" />
      </svg>
    </span>
  );
}
