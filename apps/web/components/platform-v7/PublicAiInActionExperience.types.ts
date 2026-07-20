import type { PublicExperienceIconName } from './PublicExperienceIcon';

export type Locale = 'ru' | 'en' | 'zh';
export type RoleKey = 'buyer' | 'seller' | 'bank';
export type ScenarioKey = 'quality' | 'documents' | 'settlement';
export type FactKey = 'terms' | 'trip' | 'acceptance' | 'quality' | 'documents' | 'settlement';
export type FeedbackKey = 'useful' | 'detail' | null;

export type ScenarioCopy = {
  label: string;
  title: string;
  summary: string;
  reason: string;
  impact: string;
  deadline: string;
  action: string;
  actionNote: string;
  riskBadge: string;
  attentionFact: FactKey;
  facts: Record<FactKey, { label: string; value: string; detail: string }>;
};

export type ExperienceCopy = {
  hero: {
    kicker: string;
    title: string;
    lead: string;
    primary: string;
    secondary: string;
    badges: string[];
    coreLabel: string;
    coreMode: string;
    outputLabel: string;
    outputTitle: string;
    outputText: string;
  };
  simulator: {
    eyebrow: string;
    title: string;
    lead: string;
    scenarioLegend: string;
    roleLegend: string;
    idle: string;
    running: string;
    phaseLabel: string;
    factsEyebrow: string;
    factsLead: string;
    evidenceLabel: string;
    aiEyebrow: string;
    provider: string;
    decisionEyebrow: string;
    roleFocus: string;
    reason: string;
    impact: string;
    deadline: string;
    nextAction: string;
    confirm: string;
    confirmed: string;
    controlNote: string;
    feedbackPrompt: string;
    useful: string;
    detail: string;
    play: string;
    pause: string;
    previous: string;
    next: string;
    restart: string;
    reducedMotion: string;
    contractScope: string;
    contractData: string;
    contractMode: string;
    waitingSummary: string;
    waitingValue: string;
  };
  roles: Record<RoleKey, { label: string; focus: string }>;
  scenarios: Record<ScenarioKey, ScenarioCopy>;
  phases: Array<{ title: string; short: string; narrative: string; output: string }>;
  principles: {
    eyebrow: string;
    title: string;
    lead: string;
    cards: Array<{ icon: PublicExperienceIconName; title: string; body: string }>;
  };
  boundary: {
    eyebrow: string;
    title: string;
    lead: string;
    cards: Array<{ icon: PublicExperienceIconName; label: string; title: string; body: string }>;
  };
  final: {
    eyebrow: string;
    title: string;
    lead: string;
    primary: string;
    secondary: string;
  };
};

export const FACT_ORDER: FactKey[] = ['terms', 'trip', 'acceptance', 'quality', 'documents', 'settlement'];
export const FACT_ICONS: Record<FactKey, PublicExperienceIconName> = {
  terms: 'execution',
  trip: 'logistics',
  acceptance: 'elevator',
  quality: 'lab',
  documents: 'documents',
  settlement: 'money',
};
