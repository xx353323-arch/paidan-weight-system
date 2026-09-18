export type PeriodStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'computed'
  | 'published'
  | 'archived';

export type RaterState = 'not_started' | 'in_progress' | 'finished';

export type PeriodInfo = {
  id: number;
  code: string;
  year: number;
  month: number;
  status: PeriodStatus;
  statusLabel: string;
  openAt?: string | null;
  closeAt?: string | null;
  publishedAt?: string | null;
  taskTotal: number;
  taskDone: number;
  taskRate: number;
};

export type EvaluatePeriod = {
  id: number;
  code: string;
  status: PeriodStatus;
  statusLabel: string;
  openAt?: string | null;
  closeAt?: string | null;
};

export type EvaluateSummary = {
  total: number;
  submitted: number;
  unknown: number;
  draft: number;
  pending: number;
};

export type EvaluateOverview = {
  period: EvaluatePeriod | null;
  roleCode: string;
  roleLabel: string;
  summary: EvaluateSummary;
  editable: boolean;
};

export type RankingTag = {
  id: number;
  name: string;
  color: string;
};

export type RankingItem = {
  employeeId: number;
  empNo: string;
  name: string;
  rankNo?: number | null;
  wFinal: number;
  wPrev?: number | null;
  delta?: number | null;
  gradeCode: string;
  coverageLevel?: string;
  coverageLabel?: string;
  tags: RankingTag[];
};

export type ProgressRater = {
  raterUserId: number;
  raterName: string;
  roleCode: string;
  total: number;
  submitted: number;
  unknown: number;
  draft: number;
  pending: number;
  expired: number;
  done: number;
  rate: number;
  state: RaterState;
  lastSavedAt?: string | null;
};

export type ProgressSummary = {
  taskTotal: number;
  taskDone: number;
  rate: number;
  raterTotal: number;
  raterFinished: number;
};

export type PeriodProgress = {
  items: ProgressRater[];
  summary: ProgressSummary;
  period: PeriodInfo;
};
