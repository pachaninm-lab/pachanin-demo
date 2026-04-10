import Link from 'next/link';
import type { ReactNode } from 'react';
import styles from './ui.module.css';

type Tone='success'|'warning'|'info'|'danger'|'muted';
type ButtonTone='primary'|'secondary'|'ghost';
type IconName='market'|'buyer'|'bank'|'deal'|'docs'|'logistics'|'lab'|'observer'|'shield'|'flow'|'ai'|'onboarding'|'regulatory'|'pilot'|'integration';

const toneClass:Record<Tone,string>={success:styles.toneSuccess,warning:styles.toneWarning,info:styles.toneInfo,danger:styles.toneDanger,muted:styles.toneMuted};
const chipToneClass:Record<Tone,string>={success:styles.chipSuccess,warning:styles.chipWarning,info:styles.chipInfo,danger:styles.chipDanger,muted:styles.chipMuted};
const buttonToneClass:Record<ButtonTone,string>={primary:styles.buttonPrimary,secondary:styles.buttonSecondary,ghost:styles.buttonGhost};

function path(icon:IconName){switch(icon){case'market':return' M4 5h16M4 10h10M4 15h16';case'buyer':return' M12 12a4 4 0 1 0-0.01 0M5 20c1.6-3 4.1-4.5 7-4.5S17.4 17 19 20';case'bank':return' M3 8l9-4 9 4M5 9v8M9 9v8M15 9v8M4 19h16';case'deal':return' M4 7h6l2 3h8M4 17h6l2-3h8';case'docs':return' M7 3h7l4 4v14H7z M14 3v5h5';case'logistics':return' M3 7h11v8H3z M14 10h3l2 2v3h-5z M7 17a1.5 1.5 0 1 0 0 0.01 M16 17a1.5 1.5 0 1 0 0 0.01';case'lab':return' M9 3v5l-4 8a3 3 0 0 0 2.7 4h8.6A3 3 0 0 0 19 16l-4-8V3';case'observer':return' M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 18 2 12 M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6';case'shield':return' M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z';case'flow':return' M4 7h5v4H4z M15 13h5v4h-5z M9 9h6v2H9z M9 15V9';case'ai':return' M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z';case'onboarding':return' M12 4v16M4 12h16';case'regulatory':return' M4 5h16v14H4z M8 9h8 M8 13h5';case'pilot':return' M12 3l2.5 5L20 9l-4 4 .9 6L12 16l-4.9 3 .9-6-4-4 5.5-1z';case'integration':return' M7 7h4v4H7z M13 13h4v4h-4z M11 9h2v2h-2z M9 11h2v2H9z';default:return' M4 12h16';}}

export function Icon({name,label}:{name:IconName;label?:string}){return <span className={styles.iconBox} aria-hidden={label?undefined:true} aria-label={label}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={styles.iconSvg}><path d={path(name)} /></svg></span>}

export function LinkButton({href,children,tone='secondary'}:{href:string;children:ReactNode;tone?:ButtonTone}){return <Link href={href} className={`${buttonToneClass[tone]} ${styles.focusRing}`}>{children}</Link>}

export function StatusChip({tone='muted',children}:{tone?:Tone;children:ReactNode}){return <span className={`${styles.chip} ${chipToneClass[tone]}`}>{children}</span>}

export function Hero({eyebrow,title,body,actions}:{eyebrow:string;title:string;body:string;actions?:ReactNode}){return <section className={styles.hero}><div className={styles.heroEyebrow}>{eyebrow}</div><h1 className={styles.heroTitle}>{title}</h1><p className={styles.heroBody}>{body}</p>{actions?<div className={styles.heroActions}>{actions}</div>:null}</section>}

export function ObjectHeader({code,title,body,chips,meta}:{code:string;title:string;body:string;chips?:Array<{tone?:Tone;label:string}>;meta?:Array<{label:string;value:string}>}){return <section className={styles.objectHeader}><div className={styles.objectCode}>{code}</div><h1 className={styles.objectTitle}>{title}</h1><p className={styles.objectBody}>{body}</p>{chips?.length?<div className={styles.chipRow}>{chips.map((chip)=><StatusChip key={chip.label} tone={chip.tone}>{chip.label}</StatusChip>)}</div>:null}{meta?.length?<div className={styles.metaGrid}>{meta.map((item)=><div key={item.label} className={styles.metaCard}><div className={styles.metaLabel}>{item.label}</div><div className={styles.metaValue}>{item.value}</div></div>)}</div>:null}</section>}

export function Panel({title,body,actions,children}:{title:string;body?:string;actions?:ReactNode;children:ReactNode}){return <section className={styles.panel}><div className={styles.panelHeader}><div><div className={styles.panelTitle}>{title}</div>{body?<div className={styles.panelBody}>{body}</div>:null}</div>{actions}</div>{children}</section>}

export function MetricGrid({items}:{items:Array<{icon:IconName;value:string;label:string;hint?:string;tone?:Tone}>}){return <section className={styles.metricGrid}>{items.map((item)=><article key={item.label} className={styles.metricCard}><div className={styles.metricTop}><Icon name={item.icon} /><div className={`${styles.metricHint} ${toneClass[item.tone??'muted']}`}>{item.hint}</div></div><div><div className={styles.metricValue}>{item.value}</div><div className={styles.metricLabel}>{item.label}</div></div></article>)}</section>}

export function DenseRows({rows}:{rows:Array<{title:string;text?:string;meta?:ReactNode;href?:string}>}){return <div className={styles.denseList}>{rows.map((row)=>row.href?<Link key={row.title} href={row.href} className={`${styles.denseRowLink} ${styles.focusRing}`}><div><div className={styles.denseTitle}>{row.title}</div>{row.text?<div className={styles.denseText}>{row.text}</div>:null}</div>{row.meta?<div className={styles.denseMeta}>{row.meta}</div>:null}</Link>:<div key={row.title} className={styles.denseRow}><div><div className={styles.denseTitle}>{row.title}</div>{row.text?<div className={styles.denseText}>{row.text}</div>:null}</div>{row.meta?<div className={styles.denseMeta}>{row.meta}</div>:null}</div>)}</div>}

export function DataTable({columns,rows}:{columns:string[];rows:Array<Array<ReactNode>>}){return <div className={styles.tableWrap}><table className={styles.denseTable}><thead><tr>{columns.map((column)=><th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row,index)=><tr key={index}>{row.map((cell,cellIndex)=><td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>}

export const ui=styles;
