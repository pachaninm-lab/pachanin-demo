import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, LockKeyhole, RefreshCw, SearchX, WifiOff } from 'lucide-react';

export type CanonicalUxStateKind =
  | 'loading'
  | 'empty'
  | 'success'
  | 'validation-error'
  | 'unavailable'
  | 'stale'
  | 'permission-denied'
  | 'conflict'
  | 'retry';

const ICONS={
  loading:LoaderCircle,
  empty:SearchX,
  success:CheckCircle2,
  'validation-error':AlertTriangle,
  unavailable:WifiOff,
  stale:Clock3,
  'permission-denied':LockKeyhole,
  conflict:RefreshCw,
  retry:RefreshCw,
} as const;

export function CanonicalUxState({
  kind,
  title,
  description,
  action,
  actionHref,
  actionLabel,
  compact=false,
}:{
  kind:CanonicalUxStateKind;
  title:string;
  description:string;
  action?:ReactNode;
  actionHref?:string;
  actionLabel?:string;
  compact?:boolean;
}){
  const Icon=ICONS[kind];
  const live=kind==='loading'?'polite':kind==='success'?'polite':'assertive';
  return (
    <section className={`pc-cp-ux-state${compact?' pc-cp-ux-state--compact':''}`} data-ux-state={kind} role={kind==='loading'?'status':'region'} aria-live={live}>
      <div className='pc-cp-ux-state-icon' aria-hidden='true'><Icon size={22}/></div>
      <div className='pc-cp-ux-state-copy'><strong>{title}</strong><p>{description}</p></div>
      {action??(actionHref&&actionLabel?<Link className='pc-cp-button pc-cp-button--secondary' href={actionHref}>{actionLabel}</Link>:null)}
    </section>
  );
}
