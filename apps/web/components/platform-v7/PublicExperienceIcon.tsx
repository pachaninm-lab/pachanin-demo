import type { SVGProps } from 'react';

export type PublicExperienceIconName =
  | 'execution'
  | 'participants'
  | 'documents'
  | 'money'
  | 'risk'
  | 'intelligence'
  | 'seller'
  | 'buyer'
  | 'logistics'
  | 'driver'
  | 'elevator'
  | 'lab'
  | 'surveyor'
  | 'bank'
  | 'operator'
  | 'compliance'
  | 'arbitrator'
  | 'executive'
  | 'check'
  | 'arrow'
  | 'pause'
  | 'play'
  | 'close';

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function PublicExperienceIcon({
  name,
  size = 22,
  ...props
}: SVGProps<SVGSVGElement> & { name: PublicExperienceIconName; size?: number }) {
  const body = iconBody(name);
  return (
    <svg
      aria-hidden='true'
      focusable='false'
      viewBox='0 0 24 24'
      width={size}
      height={size}
      {...common}
      {...props}
    >
      {body}
    </svg>
  );
}

function iconBody(name: PublicExperienceIconName) {
  switch (name) {
    case 'execution':
      return <><circle cx='5' cy='12' r='2.3' /><circle cx='19' cy='6' r='2.3' /><circle cx='19' cy='18' r='2.3' /><path d='M7.2 11.2 16.8 6.8M7.2 12.8l9.6 4.4' /></>;
    case 'participants':
      return <><circle cx='8' cy='8' r='3' /><circle cx='17' cy='9' r='2.4' /><path d='M3.5 19c.5-4 2.2-6 4.5-6s4 2 4.5 6M13.5 18c.4-3 1.6-4.6 3.5-4.6 1.8 0 3.1 1.5 3.5 4.6' /></>;
    case 'documents':
      return <><path d='M6 3.5h8l4 4V20.5H6z' /><path d='M14 3.5v4h4M9 12h6M9 16h6' /></>;
    case 'money':
      return <><circle cx='12' cy='12' r='8.5' /><path d='M14.6 8.5h-3a2.1 2.1 0 0 0 0 4.2h1a2.1 2.1 0 0 1 0 4.2H9.4M12 6.5v2M12 16.9v1.6' /></>;
    case 'risk':
      return <><path d='M12 3.5 21 20H3z' /><path d='M12 9v5M12 17.2h.01' /></>;
    case 'intelligence':
      return <><path d='M9 4.5a3 3 0 0 1 5 2.2 3.2 3.2 0 0 1 2.3 4.9 3.3 3.3 0 0 1-1.5 5.5 3 3 0 0 1-5.6.4A3.2 3.2 0 0 1 5 14.5a3.2 3.2 0 0 1 .7-5.8A3 3 0 0 1 9 4.5Z' /><path d='M12 5v14M8.5 8.5c2 0 3.5 1.2 3.5 3M15.5 14.5c-2 0-3.5-1.2-3.5-3' /></>;
    case 'seller':
      return <><path d='M4 9.5 12 4l8 5.5v9H4z' /><path d='M8 19v-6h8v6M8 9h.01M12 9h.01M16 9h.01' /></>;
    case 'buyer':
      return <><path d='M4 5h2l2 10h9l2-7H7.2M9.5 19a1 1 0 1 0 0 .01M16.5 19a1 1 0 1 0 0 .01' /></>;
    case 'logistics':
      return <><path d='M3.5 7.5h10v9h-10zM13.5 10h4l3 3v3.5h-7z' /><circle cx='7' cy='18' r='1.8' /><circle cx='17.5' cy='18' r='1.8' /></>;
    case 'driver':
      return <><circle cx='12' cy='8' r='3' /><path d='M6.5 20c.5-4.5 2.3-7 5.5-7s5 2.5 5.5 7M8.5 16h7' /></>;
    case 'elevator':
      return <><path d='M6 20V7l6-3 6 3v13M9 20v-5h6v5M9 9h6M9 12h6' /></>;
    case 'lab':
      return <><path d='M9 3.5h6M10 3.5v5l-5 9A2 2 0 0 0 6.8 20h10.4a2 2 0 0 0 1.8-2.5l-5-9v-5' /><path d='M7.5 15h9' /></>;
    case 'surveyor':
      return <><circle cx='10.5' cy='10.5' r='5.5' /><path d='m14.5 14.5 5 5M8 10.5l1.6 1.7 3.4-3.7' /></>;
    case 'bank':
      return <><path d='m3 9 9-5 9 5M5 10h14M6 10v7M10 10v7M14 10v7M18 10v7M4 20h16' /></>;
    case 'operator':
      return <><rect x='3.5' y='4' width='17' height='16' rx='2' /><path d='M7 9h10M7 13h6M7 17h8' /></>;
    case 'compliance':
      return <><path d='M12 3.5 19 6v5.5c0 4.5-2.7 7.3-7 9-4.3-1.7-7-4.5-7-9V6z' /><path d='m8.5 12 2.2 2.2 4.8-5' /></>;
    case 'arbitrator':
      return <><path d='M12 4v16M6 7h12M5 7l-3 6h6zM19 7l-3 6h6zM8 20h8' /></>;
    case 'executive':
      return <><path d='M4 20V10M10 20V4M16 20v-7M22 20H2' /><path d='m4 7 6-4 6 7 5-5' /></>;
    case 'check':
      return <path d='m5 12.5 4.2 4.2L19 7' />;
    case 'arrow':
      return <><path d='M5 12h14M14 7l5 5-5 5' /></>;
    case 'pause':
      return <><path d='M9 6v12M15 6v12' /></>;
    case 'play':
      return <path d='m9 6 9 6-9 6z' />;
    case 'close':
      return <><path d='m7 7 10 10M17 7 7 17' /></>;
    default:
      return null;
  }
}
