export type AdjustType = 'MULTIPLIER' | 'DELTA' | 'OVERRIDE' | 'FREEZE';

export type AdjustStatus = 'active' | 'revoked' | 'expired';

export type AdjustmentItem = {
  id: number;
  employeeId: number;
  employeeName: string;
  empNo: string;
  adjustType: AdjustType;
  adjustTypeLabel: string;
  value?: number | null;
  valueLabel: string;
  reason: string;
  effectiveFromPeriodId: number;
  effectiveToPeriodId?: number | null;
  effectiveFromCode?: string | null;
  effectiveToCode?: string | null;
  status: AdjustStatus;
  statusLabel: string;
  createdByName?: string | null;
  createdAt?: string | null;
  revokedByName?: string | null;
  revokedAt?: string | null;
  revokeReason?: string | null;
};

export type AdjustmentCreateResult = AdjustmentItem & {
  warnings: string[];
};

export type AdjustmentQueryParams = {
  current?: number;
  pageSize?: number;
  employeeId?: number;
  status?: AdjustStatus;
  adjustType?: AdjustType;
  periodId?: number;
};

export type AdjustmentCreatePayload = {
  employeeId: number;
  adjustType: AdjustType;
  value?: number | null;
  reason: string;
  effectiveFromPeriodId: number;
  effectiveToPeriodId?: number | null;
};

export type AdjustmentFormValues = {
  employeeId?: number;
  adjustType?: AdjustType;
  value?: number;
  reason?: string;
  effectiveFromPeriodId?: number;
  effectiveToPeriodId?: number | null;
};

export type PreviewRow = {
  employeeId: number;
  empNo: string;
  name: string;
  rankNo?: number | null;
  wFinal: number;
  gradeCode?: string | null;
  isFrozen: boolean;
  adjustSummary?: string | null;
};

export type RankChange = {
  employeeId: number;
  name: string;
  empNo: string;
  rankBefore?: number | null;
  rankAfter?: number | null;
  scoreBefore: number;
  scoreAfter: number;
  scoreDelta: number;
  rankDelta?: number | null;
  gradeBefore?: string | null;
  gradeAfter?: string | null;
  isTarget: boolean;
};

export type GradeDistItem = {
  code: string;
  label: string;
  count: number;
};

export type PreviewPayload = {
  periodId: number;
  adjustments: {
    employeeId: number;
    adjustType: AdjustType;
    value?: number | null;
  }[];
};

export type PreviewResult = {
  periodId: number;
  periodCode: string;
  before: PreviewRow[];
  after: PreviewRow[];
  rankChanges: RankChange[];
  gradeDistributionBefore: GradeDistItem[];
  gradeDistributionAfter: GradeDistItem[];
};

export type SelectOption = {
  label: string;
  value: number;
  empNo?: string;
};

export type PeriodOption = SelectOption & {
  code: string;
  status: string;
};

export type EmployeeScore = {
  employeeId: number;
  name: string;
  rankNo?: number | null;
  wFinal: number;
  gradeCode?: string | null;
};
