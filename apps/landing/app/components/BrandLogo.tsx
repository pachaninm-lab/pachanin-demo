type BrandLogoProps = {
  className?: string;
};

export default function BrandLogo({ className = 'h-9 w-9' }: BrandLogoProps) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center rounded-xl ${className}`} aria-hidden="true">
      <svg viewBox="0 0 96 96" className="h-full w-full drop-shadow-[0_0_18px_rgba(126,242,196,0.18)]" role="img">
        <defs>
          <linearGradient id="pc-shell" x1="14" y1="8" x2="82" y2="90" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0D7A5F" />
            <stop offset="1" stopColor="#04261F" />
          </linearGradient>
          <linearGradient id="pc-glass" x1="20" y1="16" x2="76" y2="82" gradientUnits="userSpaceOnUse">
            <stop stopColor="#123C33" />
            <stop offset="1" stopColor="#061512" />
          </linearGradient>
          <linearGradient id="pc-metal" x1="22" y1="18" x2="75" y2="82" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F4F0E6" />
            <stop offset="0.54" stopColor="#A7A99E" />
            <stop offset="1" stopColor="#5C625B" />
          </linearGradient>
          <linearGradient id="pc-line" x1="17" y1="76" x2="72" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#57D7B3" />
            <stop offset="1" stopColor="#9CFFD9" />
          </linearGradient>
        </defs>
        <rect x="7" y="7" width="82" height="82" rx="24" fill="url(#pc-shell)" />
        <rect x="16" y="16" width="64" height="64" rx="17" fill="url(#pc-glass)" stroke="#173D34" strokeWidth="2" />
        <path d="M29 66V29h25v31l-8 7V39H39v27H29Z" fill="url(#pc-metal)" />
        <path d="M58 66V29h10v29h9v8H58Z" fill="url(#pc-metal)" opacity="0.88" />
        <path d="M19 73l13-13h12l15-19h9" fill="none" stroke="#03241E" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
        <path d="M19 73l13-13h12l15-19h9" fill="none" stroke="url(#pc-line)" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="70" cy="40" r="8" fill="#06241E" />
        <circle cx="70" cy="40" r="5.4" fill="#8FFFD5" />
      </svg>
    </span>
  );
}
