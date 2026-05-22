export const PLATFORM_V7_CANONICAL_ROLES = [
  'platform_admin',
  'operator',
  'seller',
  'buyer',
  'logistics_manager',
  'carrier',
  'driver',
  'elevator_operator',
  'lab_specialist',
  'surveyor',
  'bank_officer',
  'compliance_officer',
  'arbitrator',
  'support_agent',
  'executive_viewer',
  'investor',
] as const;

export type PlatformV7CanonicalRole = (typeof PLATFORM_V7_CANONICAL_ROLES)[number];

export const PLATFORM_V7_CANONICAL_ROLE_NAMES = {
  platform_admin: 'PlatformAdmin',
  operator: 'Operator',
  seller: 'Seller',
  buyer: 'Buyer',
  logistics_manager: 'LogisticsManager',
  carrier: 'Carrier',
  driver: 'Driver',
  elevator_operator: 'ElevatorOperator',
  lab_specialist: 'LabSpecialist',
  surveyor: 'Surveyor',
  bank_officer: 'BankOfficer',
  compliance_officer: 'ComplianceOfficer',
  arbitrator: 'Arbitrator',
  support_agent: 'SupportAgent',
  executive_viewer: 'ExecutiveViewer',
  investor: 'Investor',
} as const satisfies Record<PlatformV7CanonicalRole, string>;

export type PlatformV7CanonicalRoleName = (typeof PLATFORM_V7_CANONICAL_ROLE_NAMES)[PlatformV7CanonicalRole];

const PLATFORM_V7_ROLE_ALIASES: Record<string, PlatformV7CanonicalRole> = {
  platformAdmin: 'platform_admin',
  platform_admin: 'platform_admin',
  admin: 'platform_admin',
  operator: 'operator',
  seller: 'seller',
  buyer: 'buyer',
  logistics: 'logistics_manager',
  logisticsManager: 'logistics_manager',
  logistics_manager: 'logistics_manager',
  carrier: 'carrier',
  driver: 'driver',
  elevator: 'elevator_operator',
  elevatorOperator: 'elevator_operator',
  elevator_operator: 'elevator_operator',
  lab: 'lab_specialist',
  labSpecialist: 'lab_specialist',
  lab_specialist: 'lab_specialist',
  surveyor: 'surveyor',
  bank: 'bank_officer',
  bankOfficer: 'bank_officer',
  bank_officer: 'bank_officer',
  compliance: 'compliance_officer',
  complianceOfficer: 'compliance_officer',
  compliance_officer: 'compliance_officer',
  arbitrator: 'arbitrator',
  support: 'support_agent',
  supportAgent: 'support_agent',
  support_agent: 'support_agent',
  executive: 'executive_viewer',
  executiveViewer: 'executive_viewer',
  executive_viewer: 'executive_viewer',
  investor: 'investor',
  investor_readonly: 'investor',
};

export function toPlatformV7CanonicalRole(role: string): PlatformV7CanonicalRole | null {
  return PLATFORM_V7_ROLE_ALIASES[role] ?? null;
}

export function platformV7CanonicalRoleName(role: PlatformV7CanonicalRole): PlatformV7CanonicalRoleName {
  return PLATFORM_V7_CANONICAL_ROLE_NAMES[role];
}
