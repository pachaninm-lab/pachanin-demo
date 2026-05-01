export default function HeaderLogo() {
  return (
    <span className="brand-logo-mark shrink-0" aria-hidden="true">
      <svg viewBox="0 0 64 64" role="img" focusable="false" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="pcLogoGold" x1="18" y1="12" x2="48" y2="54" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F9E6A5" />
            <stop offset="0.42" stopColor="#D5A94A" />
            <stop offset="1" stopColor="#8F6320" />
          </linearGradient>
          <linearGradient id="pcLogoGreen" x1="13" y1="14" x2="51" y2="54" gradientUnits="userSpaceOnUse">
            <stop stopColor="#87F7CC" />
            <stop offset="0.48" stopColor="#15B887" />
            <stop offset="1" stopColor="#07513F" />
          </linearGradient>
          <filter id="pcLogoShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.6" floodColor="#000000" floodOpacity="0.36" />
          </filter>
        </defs>
        <rect x="3" y="3" width="58" height="58" rx="16" fill="#061611" />
        <path d="M13 45.5C20.5 33.5 28 22.5 37.8 12.5C42.3 15.3 47.6 18 53.4 19.6C45.8 31.4 38.8 42 28.9 52.1C24.2 49.3 18.7 47 13 45.5Z" fill="url(#pcLogoGreen)" filter="url(#pcLogoShadow)" />
        <path d="M21.5 45.6C26.8 37.1 32.4 28.8 39.6 21.2C42.2 22.7 45.4 24.1 48.7 25.1C43.1 33.8 37.9 41.8 30.7 49.2C27.7 47.6 24.7 46.4 21.5 45.6Z" fill="#04100D" opacity="0.74" />
        <path d="M17.6 19.4L24.1 13.3L32.8 32.1L26.2 38.1L17.6 19.4Z" fill="url(#pcLogoGold)" filter="url(#pcLogoShadow)" />
        <path d="M39.9 13.5L46.8 18.8L28.4 51.2L21.5 45.9L39.9 13.5Z" fill="url(#pcLogoGold)" filter="url(#pcLogoShadow)" />
        <path d="M22.5 13.8L39.8 13.8L34.4 21.4H25.8L22.5 13.8Z" fill="#F5D988" opacity="0.95" />
        <path d="M29.1 51.1L46.1 51.1L49.7 43.6H34.1L29.1 51.1Z" fill="#A87524" opacity="0.92" />
        <path d="M14 45.1C22.8 42.8 35.2 43.3 49.7 45.6" stroke="#7EF2C4" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
      </svg>
    </span>
  );
}
