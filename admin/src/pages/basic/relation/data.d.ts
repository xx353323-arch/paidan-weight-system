export type CoverageMode = 'ALL' | 'EXPLICIT';

export type RelationTag = {
  id: number;
  name: string;
  color: string;
};

export type RaterItem = {
  userId: number;
  username: string;
  displayName: string;
  roleCode: string;
  roleLabel: string;
  coverageMode: CoverageMode;
  isActive: boolean;
  targetCount: number;
};

export type RelationEmployee = {
  id: number;
  empNo: string;
  name: string;
  employmentStatus: string;
  tags: RelationTag[];
  leadUserId?: number | null;
  leadName?: string | null;
  raterCount?: number;
  coveredRoles?: string[];
  missingRoles?: string[];
  nominalCoverage?: number;
};

export type TargetsResult = {
  raterUserId: number;
  displayName: string;
  roleCode: string;
  roleLabel: string;
  coverageMode: CoverageMode;
  targetIds: number[];
  employees: RelationEmployee[];
};

export type SaveTargetsParams = {
  roleCode: string;
  targetIds: number[];
  coverageMode: CoverageMode;
};

export type SaveTargetsResult = {
  coverageMode: CoverageMode;
  addedNames: string[];
  removedNames: string[];
  addedCount: number;
  removedCount: number;
  totalCount: number;
};

export type MatrixCell = {
  employeeId: number;
  raterUserId: number;
  roleCode: string;
  expanded: boolean;
};

export type RoleWeight = {
  roleCode: string;
  label: string;
  weight: number;
  isMandatory: boolean;
};

export type MatrixSummary = {
  employeeCount: number;
  raterCount: number;
  cellCount: number;
  insufficientCount: number;
  insufficientNames: string[];
  missingLeadCount: number;
  missingLeadNames: string[];
  missingDeliveryCount: number;
  missingDeliveryNames: string[];
  avgRaterCount: number;
};

export type MatrixResult = {
  raters: RaterItem[];
  employees: RelationEmployee[];
  cells: MatrixCell[];
  roleWeights: RoleWeight[];
  summary: MatrixSummary;
};

export type CoverageCheckItem = {
  employeeId: number;
  name: string;
  empNo: string;
  tags: RelationTag[];
  leadName?: string | null;
  coveredRoles: string[];
  coveredRoleLabels: string[];
  missingRoles: string[];
  missingRoleLabels: string[];
  raterCount: number;
  raterNames: string[];
  nominalCoverage: number;
  hasLead: boolean;
  hasDelivery: boolean;
  passed: boolean;
};

export type CoverageCheckResult = {
  items: CoverageCheckItem[];
  roleWeights: RoleWeight[];
  summary: {
    employeeCount: number;
    passedCount: number;
    blockedCount: number;
    noLeadNames: string[];
    noDeliveryNames: string[];
    thinNames: string[];
    avgNominalCoverage: number;
  };
};

export type CopyFromLastResult = {
  applied: boolean;
  createdCount: number;
  periodCode: string | null;
  message: string;
};

export type LeadConflict = {
  employeeId: number;
  name: string;
  empNo: string;
  currentLeadUserId: number;
  currentLeadName: string;
};

export type BizErrorInfo = {
  errorCode?: number;
  errorMessage?: string;
  showType?: number;
  data?: {
    conflicts?: LeadConflict[];
    conflictNames?: string[];
  } | null;
};
