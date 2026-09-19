'use client';
import * as React from 'react';
import { ChevronDown, CheckCircle2, Clock, Circle, XCircle, User, FileText } from 'lucide-react';
import { cn } from '@/lib/v9/utils';
import { Badge } from '../ui/badge';
import { phases, getPhaseState, statusLabels, type DealStatus, type Phase } from '@/lib/v9/statuses';

interface TimelineEvent {
  status: DealStatus;
  at: string;
  actor: string;
}

interface PhaseTimelineProps {
  currentStatus: DealStatus;
  timeline: TimelineEvent[];
  evidenceCounts?: Partial<Record<Phase, number>>;
  className?: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

const stateColors = {
  done: { bg: '#16A34A', text: '#fff', border: 'rgba(22,163,74,0.3)' },
  active: { bg: '#0A7A5F', text: '#fff', border: 'rgba(10,122,95,0.3)' },
  blocked: { bg: '#DC2626', text: '#fff', border: 'rgba(220,38,38,0.3)' },
  pending: { bg: '#F4F5F7', text: '#6B778C', border: '#E4E6EA' },
};

const stateIcons = {
  done: CheckCircle2,
  active: Clock,
  blocked: XCircle,
  pending: Circle,
};

export function PhaseTimeline({ currentStatus, timeline, evidenceCounts = {}, className }: PhaseTimelineProps) {
  const [expanded, setExpanded] = React.useState<Set<Phase>>(
    new Set([getActivePhase(currentStatus)])
  );

  function toggle(id: Phase) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={cn('flex flex-col gap-2', className)} role="list" aria-label="Этапы сделки">
      {phases.map((phase, phaseIdx) => {
        const state = getPhaseState(phase, currentStatus);
        const colors = stateColors[state];
        const Icon = stateIcons[state];
        const isOpen = expanded.has(phase.id);
        const phaseEvents = timeline.filter(e => phase.steps.includes(e.status));
        const doneSteps = phaseEvents.length;
        const totalSteps = phase.steps.length;
        const evidenceCount = evidenceCounts[phase.id] ?? 0;

        return (
          <div
            key={phase.id}
            role="listitem"
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              overflow: 'hidden',
              transition: 'box-shadow 0.15s',
            }}
          >
            {/* Phase header — always visible */}
            <button
              onClick={() => toggle(phase.id)}
              aria-expanded={isOpen}
              aria-controls={`phase-${phase.id}`}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                background: state === 'done' ? 'rgba(22,163,74,0.04)'
                  : state === 'active' ? 'rgba(10,122,95,0.04)'
                  : state === 'blocked' ? 'rgba(220,38,38,0.04)'
                  : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              {/* Phase number badge */}
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: colors.bg, color: colors.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, flexShrink: 0,
              }} aria-hidden>
                {state === 'done' ? <CheckCircle2 size={14} />
                  : state === 'blocked' ? <XCircle size={14} />
                  : state === 'active' ? <Clock size={14} />
                  : phaseIdx + 1}
              </div>

              {/* Phase info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#0F1419' }}>
                    {phase.label}
                  </span>
                  <Badge
                    variant={
                      state === 'done' ? 'success'
                        : state === 'active' ? 'brand'
                        : state === 'blocked' ? 'danger'
                        : 'neutral'
                    }
                  >
                    {state === 'done' ? 'Завершён'
                      : state === 'active' ? 'В работе'
                      : state === 'blocked' ? 'Заблокирован'
                      : 'Ожидает'}
                  </Badge>
                  {evidenceCount > 0 && (
                    <Badge variant="info">
                      <FileText size={9} /> {evidenceCount}
                    </Badge>
                  )}
                </div>
                <div style={{ fontSize: 11, color: '#6B778C', marginTop: 2 }}>
                  {doneSteps} / {totalSteps} шагов выполнено
                </div>
              </div>

              {/* Progress + chevron */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 48, height: 4, background: '#E4E6EA', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    width: `${totalSteps ? (doneSteps / totalSteps) * 100 : 0}%`,
                    height: '100%', background: colors.bg, borderRadius: 999, transition: 'width 0.4s',
                  }} />
                </div>
                <ChevronDown
                  size={16}
                  color="#6B778C"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
                />
              </div>
            </button>

            {/* Expanded steps */}
            {isOpen && (
              <div
                id={`phase-${phase.id}`}
                style={{
                  borderTop: `1px solid ${colors.border}`,
                  padding: '12px 16px 14px 56px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}
              >
                {phase.steps.map(step => {
                  const event = timeline.find(e => e.status === step);
                  const stepDone = !!event;
                  const stepActive = step === currentStatus;

                  return (
                    <div key={step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      {/* Step indicator */}
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0,
                        background: stepDone ? '#16A34A'
                          : stepActive ? '#0A7A5F'
                          : state === 'blocked' && step === currentStatus ? '#DC2626'
                          : '#C1C7D0',
                      }} aria-hidden />

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 12, fontWeight: stepActive ? 700 : 500,
                          color: stepActive ? '#0A7A5F' : stepDone ? '#0F1419' : '#6B778C',
                        }}>
                          {statusLabels[step]}
                        </div>
                        {event && (
                          <div style={{ fontSize: 11, color: '#6B778C', marginTop: 1, display: 'flex', gap: 6 }}>
                            <User size={10} aria-hidden />
                            <span>{event.actor}</span>
                            <span>·</span>
                            <span>{fmtDate(event.at)}</span>
                          </div>
                        )}
                      </div>

                      {stepDone && (
                        <CheckCircle2 size={12} color="#16A34A" aria-label="Выполнено" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getActivePhase(status: DealStatus): Phase {
  for (const phase of phases) {
    if (phase.steps.includes(status)) return phase.id;
  }
  return 'contract';
}
