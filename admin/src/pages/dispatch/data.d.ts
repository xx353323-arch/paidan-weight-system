export type GradeCode = 'S' | 'A' | 'B' | 'C' | 'D';

export type CoverageLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'THIN' | 'NONE';

export type EmploymentStatus =
  | 'probation'
  | 'regular'
  | 'leaving'
  | 'left'
  | 'suspended';

export type AdjustType = 'FREEZE' | 'OVERRIDE' | 'MULTIPLIER' | 'DELTA';

export type DispatchTag = {
  id: number;
  name: string;
  color: string;
};

export type RankingItem = {
  employeeId: number;
  empNo: string;
  name: string;
  rankNo: number | null;
  wFinal: number;
  wPrev: number | null;
  delta: number | null;
  gradeCode: GradeCode | string;
  scoreBand: number | null;
  coverageScore: number | null;
  coverageLevel: CoverageLevel | string;
  coverageLabel: string;
  raterCount: number;
  effectiveN: number;
  missingRoles: string[];
  isFrozen: boolean;
  isCarryForward: boolean;
  floorApplied: boolean;
  adjustSummary: string | null;
  employmentStatus: EmploymentStatus | string;
  inDispatchPool: boolean;
  tags: DispatchTag[];
  groupName: string;
  groupSort: number;
  groupRank: number | null;
  groupTotal: number;
};

export type RankingQueryParams = {
  periodId?: number;
  keyword?: string;
  grade?: string;
  tagIds?: string;
  includeDraft?: boolean;
  current?: number;
  pageSize?: number;
};

export type ResultPeriodOption = {
  value: number;
  label: string;
  code: string;
  isPublished: boolean;
};

export type PeriodMeta = {
  id: number;
  code: string;
  status: string;
  statusLabel: string;
  publishedAt: string | null;
};

export type DetailEmployee = {
  id: number;
  empNo: string;
  name: string;
  employmentStatus: EmploymentStatus | string;
  tags: DispatchTag[];
};

export type DetailPeriod = {
  id: number;
  code: string;
  status: string;
};

export type ScoreSnapshot = {
  wFinal: number;
  wRaw: number;
  wPrev: number | null;
  wSmooth: number | null;
  wAdjusted: number | null;
  smoothAlpha: number | null;
  sSubj: number | null;
  gradeCode: GradeCode | string;
  rankNo: number | null;
  rankPct: number | null;
  coverageScore: number | null;
  coverageLevel: CoverageLevel | string;
  coverageLabel: string;
  gamma: number | null;
  raterCount: number;
  effectiveN: number;
  scoreBand: number | null;
  missingRoles: string[];
  coveredRoles: string[];
  isFrozen: boolean;
  isCarryForward: boolean;
  floorApplied: boolean;
  adjustSummary: string | null;
  isPublished: boolean;
};

export type ScoreBlock = {
  roleCode: string;
  roleLabel: string;
  blockScore: number | null;
  nominalWeight: number;
  credibility: number;
  appliedWeight: number;
  raterCount: number;
  familiaritySum: number;
  effectiveN: number;
  wasMissing: boolean;
};

export type RaterSummaryItem = {
  roleCode: string;
  roleLabel: string;
  count: number;
  familiaritySum: number;
};

export type AdjustmentRecord = {
  adjustType: AdjustType | string;
  valueUsed: number | null;
  valueBefore: number | null;
  valueAfter: number | null;
  wasEffective: boolean;
  skipReason: string | null;
  reason: string;
  createdByName: string | null;
};

export type ScoreDetail = {
  employee: DetailEmployee;
  period: DetailPeriod;
  snapshot: ScoreSnapshot;
  blocks: ScoreBlock[];
  raterSummary: RaterSummaryItem[];
  raterDetails: unknown[];
  adjustments: AdjustmentRecord[];
};

export type TieInfo = {
  rank: number | null;
  tied: boolean;
};
