export type ControlledCabinetRole =
  | 'operator'
  | 'buyer'
  | 'seller'
  | 'logistics'
  | 'driver'
  | 'surveyor'
  | 'elevator'
  | 'lab'
  | 'bank'
  | 'arbitrator'
  | 'compliance'
  | 'executive';

export type ControlledTestOrganization = {
  id: string;
  tenantId: string;
  tenant_id: string;
  name: string;
  shortName: string;
  inn: string;
  status: 'ACTIVE';
  kycStatus: 'VERIFIED';
  kyc_status: 'VERIFIED';
  amlStatus: 'CLEAR';
  aml_status: 'CLEAR';
  testData: true;
  organizationType: 'PLATFORM' | 'BUYER' | 'SELLER' | 'LOGISTICS' | 'SURVEYOR' | 'ELEVATOR' | 'LAB' | 'BANK' | 'ARBITRATION';
};

export type ControlledCabinetContext = {
  role: ControlledCabinetRole;
  apiRole: string;
  organizationId: string;
  organizationName: string;
  tenantId: string;
  memberEmail: string;
  memberName: string;
};

export const CONTROLLED_TEST_TENANT_ID = 'tenant-canonical-test';

function organization(
  id: string,
  name: string,
  shortName: string,
  inn: string,
  organizationType: ControlledTestOrganization['organizationType'],
): ControlledTestOrganization {
  return {
    id,
    tenantId: CONTROLLED_TEST_TENANT_ID,
    tenant_id: CONTROLLED_TEST_TENANT_ID,
    name,
    shortName,
    inn,
    status: 'ACTIVE',
    kycStatus: 'VERIFIED',
    kyc_status: 'VERIFIED',
    amlStatus: 'CLEAR',
    aml_status: 'CLEAR',
    testData: true,
    organizationType,
  };
}

export const CONTROLLED_TEST_ORGANIZATIONS: readonly ControlledTestOrganization[] = [
  organization(
    'org-canonical-platform',
    'АО «Прозрачная Цена — тестовый контур»',
    'Прозрачная Цена',
    '990000000001',
    'PLATFORM',
  ),
  organization(
    'org-canonical-buyer',
    'ООО «АгроТрейд Тест»',
    'АгроТрейд Тест',
    '990000000002',
    'BUYER',
  ),
  organization(
    'org-canonical-seller',
    'ООО «Золотое Поле Тест»',
    'Золотое Поле Тест',
    '990000000003',
    'SELLER',
  ),
  organization(
    'org-canonical-logistics',
    'ООО «ТрансАгро Тест»',
    'ТрансАгро Тест',
    '990000000004',
    'LOGISTICS',
  ),
  organization(
    'org-canonical-surveyor',
    'ООО «АгроКонтроль Тест»',
    'АгроКонтроль Тест',
    '990000000005',
    'SURVEYOR',
  ),
  organization(
    'org-canonical-elevator',
    'АО «Центральный Элеватор Тест»',
    'Центральный Элеватор Тест',
    '990000000006',
    'ELEVATOR',
  ),
  organization(
    'org-canonical-lab',
    'ООО «ЗерноЛаб Тест»',
    'ЗерноЛаб Тест',
    '990000000007',
    'LAB',
  ),
  organization(
    'org-canonical-bank',
    'АО «Банк-партнёр Тест»',
    'Банк-партнёр Тест',
    '990000000008',
    'BANK',
  ),
  organization(
    'org-canonical-arbitrator',
    'АНО «АгроАрбитраж Тест»',
    'АгроАрбитраж Тест',
    '990000000009',
    'ARBITRATION',
  ),
] as const;

const ORGANIZATION_BY_ID = new Map(
  CONTROLLED_TEST_ORGANIZATIONS.map((item) => [item.id, item] as const),
);

export const CONTROLLED_CABINET_CONTEXTS: Readonly<Record<ControlledCabinetRole, ControlledCabinetContext>> = {
  operator: {
    role: 'operator',
    apiRole: 'SUPPORT_MANAGER',
    organizationId: 'org-canonical-platform',
    organizationName: 'АО «Прозрачная Цена — тестовый контур»',
    tenantId: CONTROLLED_TEST_TENANT_ID,
    memberEmail: 'operator.test@procent-agro.test',
    memberName: 'Тестовый оператор',
  },
  buyer: {
    role: 'buyer',
    apiRole: 'BUYER',
    organizationId: 'org-canonical-buyer',
    organizationName: 'ООО «АгроТрейд Тест»',
    tenantId: CONTROLLED_TEST_TENANT_ID,
    memberEmail: 'buyer.test@procent-agro.test',
    memberName: 'Тестовый покупатель',
  },
  seller: {
    role: 'seller',
    apiRole: 'FARMER',
    organizationId: 'org-canonical-seller',
    organizationName: 'ООО «Золотое Поле Тест»',
    tenantId: CONTROLLED_TEST_TENANT_ID,
    memberEmail: 'seller.test@procent-agro.test',
    memberName: 'Тестовый продавец',
  },
  logistics: {
    role: 'logistics',
    apiRole: 'LOGISTICIAN',
    organizationId: 'org-canonical-logistics',
    organizationName: 'ООО «ТрансАгро Тест»',
    tenantId: CONTROLLED_TEST_TENANT_ID,
    memberEmail: 'logistics.test@procent-agro.test',
    memberName: 'Тестовый логист',
  },
  driver: {
    role: 'driver',
    apiRole: 'DRIVER',
    organizationId: 'org-canonical-logistics',
    organizationName: 'ООО «ТрансАгро Тест»',
    tenantId: CONTROLLED_TEST_TENANT_ID,
    memberEmail: 'driver.test@procent-agro.test',
    memberName: 'Тестовый водитель',
  },
  surveyor: {
    role: 'surveyor',
    apiRole: 'SURVEYOR',
    organizationId: 'org-canonical-surveyor',
    organizationName: 'ООО «АгроКонтроль Тест»',
    tenantId: CONTROLLED_TEST_TENANT_ID,
    memberEmail: 'surveyor.test@procent-agro.test',
    memberName: 'Тестовый сюрвейер',
  },
  elevator: {
    role: 'elevator',
    apiRole: 'ELEVATOR',
    organizationId: 'org-canonical-elevator',
    organizationName: 'АО «Центральный Элеватор Тест»',
    tenantId: CONTROLLED_TEST_TENANT_ID,
    memberEmail: 'elevator.test@procent-agro.test',
    memberName: 'Тестовый сотрудник элеватора',
  },
  lab: {
    role: 'lab',
    apiRole: 'LAB',
    organizationId: 'org-canonical-lab',
    organizationName: 'ООО «ЗерноЛаб Тест»',
    tenantId: CONTROLLED_TEST_TENANT_ID,
    memberEmail: 'lab.test@procent-agro.test',
    memberName: 'Тестовый лаборант',
  },
  bank: {
    role: 'bank',
    apiRole: 'ACCOUNTING',
    organizationId: 'org-canonical-bank',
    organizationName: 'АО «Банк-партнёр Тест»',
    tenantId: CONTROLLED_TEST_TENANT_ID,
    memberEmail: 'bank.test@procent-agro.test',
    memberName: 'Тестовый банковский сотрудник',
  },
  arbitrator: {
    role: 'arbitrator',
    apiRole: 'ARBITRATOR',
    organizationId: 'org-canonical-arbitrator',
    organizationName: 'АНО «АгроАрбитраж Тест»',
    tenantId: CONTROLLED_TEST_TENANT_ID,
    memberEmail: 'arbitrator.test@procent-agro.test',
    memberName: 'Тестовый арбитр',
  },
  compliance: {
    role: 'compliance',
    apiRole: 'COMPLIANCE_OFFICER',
    organizationId: 'org-canonical-platform',
    organizationName: 'АО «Прозрачная Цена — тестовый контур»',
    tenantId: CONTROLLED_TEST_TENANT_ID,
    memberEmail: 'compliance.test@procent-agro.test',
    memberName: 'Тестовый комплаенс-офицер',
  },
  executive: {
    role: 'executive',
    apiRole: 'EXECUTIVE',
    organizationId: 'org-canonical-platform',
    organizationName: 'АО «Прозрачная Цена — тестовый контур»',
    tenantId: CONTROLLED_TEST_TENANT_ID,
    memberEmail: 'executive.test@procent-agro.test',
    memberName: 'Тестовый руководитель',
  },
};

export function controlledOrganizationById(id: string | null | undefined): ControlledTestOrganization | null {
  return id ? ORGANIZATION_BY_ID.get(id) || null : null;
}

export function controlledCabinetContext(role: string | null | undefined): ControlledCabinetContext | null {
  if (!role) return null;
  if (Object.prototype.hasOwnProperty.call(CONTROLLED_CABINET_CONTEXTS, role)) {
    return CONTROLLED_CABINET_CONTEXTS[role as ControlledCabinetRole];
  }
  return Object.values(CONTROLLED_CABINET_CONTEXTS).find((item) => item.apiRole === role) || null;
}

export function controlledOrganizationForRole(role: string | null | undefined): ControlledTestOrganization | null {
  const context = controlledCabinetContext(role);
  return context ? controlledOrganizationById(context.organizationId) : null;
}

export function controlledRoleForOrganization(id: string): ControlledCabinetRole | null {
  const match = Object.values(CONTROLLED_CABINET_CONTEXTS).find((item) => item.organizationId === id);
  return match?.role || null;
}
