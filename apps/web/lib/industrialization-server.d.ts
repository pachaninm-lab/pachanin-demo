export type DealSpineSection = {
  key: string;
  title: string;
  owner: string;
  status: 'GREEN' | 'AMBER' | 'RED';
  summary: string;
  href: string;
};

export type DealSpineView = {
  sections: DealSpineSection[];
  nextStep: string;
  blockers: string[];
  primaryCtaHref: string;
  primaryCtaLabel: string;
};

export type RoleCurrentFocus = {
  title: string;
  detail: string;
  chips: string[];
  nextStep: string;
  href: string;
};
