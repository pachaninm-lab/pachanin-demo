import * as React from 'react';

function safeHref(raw: string): string | null {
  try {
    const value = raw.trim();
    if (value.startsWith('/')) return value;
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const matcher = /(\[[^\]]+\]\([^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`)/gu;
  let cursor = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = matcher.exec(text))) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith('**')) {
      parts.push(<strong key={key} className='font-semibold text-slate-950'>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      parts.push(<code key={key} className='rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.92em] text-slate-900'>{token.slice(1, -1)}</code>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/u.exec(token);
      const href = link ? safeHref(link[2]) : null;
      parts.push(href ? <a key={key} href={href} target={href.startsWith('/') ? undefined : '_blank'} rel={href.startsWith('/') ? undefined : 'noreferrer'} className='font-medium text-emerald-800 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-950'>{link![1]}</a> : token);
    }
    cursor = match.index + token.length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return parts;
}

function isTableDivider(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/u.test(line);
}

function cells(line: string): string[] {
  return line.trim().replace(/^\|/u, '').replace(/\|$/u, '').split('|').map((value) => value.trim());
}

export function GektaMarkdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/gu, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i += 1; continue; }

    if (line.trim().startsWith('```')) {
      const language = line.trim().slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) body.push(lines[i++]);
      if (i < lines.length) i += 1;
      blocks.push(<pre key={`code-${i}`} className='my-4 max-w-full overflow-x-auto rounded-2xl bg-slate-950 p-4 text-sm leading-6 text-slate-100'><code data-language={language || undefined}>{body.join('\n')}</code></pre>);
      continue;
    }

    if (i + 1 < lines.length && line.includes('|') && isTableDivider(lines[i + 1])) {
      const header = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      blocks.push(
        <div key={`table-${i}`} className='my-4 max-w-full overflow-x-auto rounded-2xl border border-slate-200'>
          <table className='min-w-full border-collapse text-left text-sm'>
            <thead className='bg-slate-50'><tr>{header.map((cell, idx) => <th key={idx} className='whitespace-nowrap border-b border-slate-200 px-4 py-3 font-semibold text-slate-900'>{inline(cell, `th-${i}-${idx}`)}</th>)}</tr></thead>
            <tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className='border-b border-slate-100 last:border-0'>{header.map((_, colIndex) => <td key={colIndex} className='min-w-32 px-4 py-3 align-top leading-6 text-slate-700'>{inline(row[colIndex] || '', `td-${i}-${rowIndex}-${colIndex}`)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/u.exec(line);
    if (heading) {
      const level = heading[1].length;
      const className = level === 1 ? 'mt-6 text-2xl font-semibold' : level === 2 ? 'mt-6 text-xl font-semibold' : 'mt-5 text-lg font-semibold';
      const Tag = (level === 1 ? 'h2' : level === 2 ? 'h3' : 'h4') as 'h2' | 'h3' | 'h4';
      blocks.push(<Tag key={`h-${i}`} className={`${className} tracking-tight text-slate-950`}>{inline(heading[2], `h-${i}`)}</Tag>);
      i += 1;
      continue;
    }

    if (/^\s*[-*]\s+/u.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/u.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/u, ''));
      blocks.push(<ul key={`ul-${i}`} className='my-3 list-disc space-y-2 pl-6 text-slate-700'>{items.map((item, idx) => <li key={idx} className='pl-1 leading-7'>{inline(item, `ul-${i}-${idx}`)}</li>)}</ul>);
      continue;
    }

    if (/^\s*\d+[.)]\s+/u.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/u.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/u, ''));
      blocks.push(<ol key={`ol-${i}`} className='my-3 list-decimal space-y-2 pl-6 text-slate-700'>{items.map((item, idx) => <li key={idx} className='pl-1 leading-7'>{inline(item, `ol-${i}-${idx}`)}</li>)}</ol>);
      continue;
    }

    const paragraph = [line.trim()];
    i += 1;
    while (i < lines.length && lines[i].trim() && !/^(#{1,3})\s+/u.test(lines[i]) && !/^\s*[-*]\s+/u.test(lines[i]) && !/^\s*\d+[.)]\s+/u.test(lines[i]) && !lines[i].trim().startsWith('```') && !(i + 1 < lines.length && lines[i].includes('|') && isTableDivider(lines[i + 1]))) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    const joined = paragraph.join(' ');
    blocks.push(<p key={`p-${i}`} className='my-3 leading-7 text-slate-700'>{inline(joined, `p-${i}`)}</p>);
  }
  return <div className='min-w-0'>{blocks}</div>;
}
