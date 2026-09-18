export type PeriodStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'computed'
  | 'published'
  | 'archived';

export type SubmissionStatus =
  | 'PENDING'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNKNOWN'
  | 'EXPIRED';

export type ScoringPeriod = {
  id: number;
  code: string;
  status: PeriodStatus;
  statusLabel: string;
  closeAt?: string | null;
  openAt?: string | null;
};

export type ScoringItem = {
  code: string;
  label: string;
  weight: number;
  anchorText?: string | null;
  commentRequiredBelow: number;
};

export type FamiliarityOption = {
  code: string;
  label: string;
  weight: number;
  isUnknown: boolean;
};

export type TargetTag = {
  id: number;
  name: string;
  color: string;
};

export type ScoringTarget = {
  employeeId: number;
  empNo: string;
  name: string;
  leadUserId?: number | null;
  leadName?: string | null;
  tags: TargetTag[];
  status: SubmissionStatus;
  familiarityCode?: string | null;
  scores: Record<string, number>;
  comments: Record<string, string>;
  overallComment?: string | null;
  updatedAt?: string | null;
};

export type ScoringSummary = {
  total: number;
  submitted: number;
  unknown: number;
  draft: number;
  pending: number;
};

export type ScoringTaskResult = {
  period: ScoringPeriod | null;
  roleCode: string;
  roleLabel: string;
  items: ScoringItem[];
  familiarityOptions: FamiliarityOption[];
  targets: ScoringTarget[];
  summary: ScoringSummary;
  editable: boolean;
};

export type DraftRecord = {
  employeeId: number;
  familiarityCode?: string | null;
  scores: Record<string, number>;
  comments: Record<string, string>;
  overallComment?: string | null;
};

export type SaveDraftParams = {
  periodId: number;
  records: DraftRecord[];
};

export type SaveDraftResult = {
  savedCount: number;
  savedAt: string;
};

export type SubmitResult = {
  submittedCount: number;
  unknownCount: number;
  submittedAt: string;
};

export type MarkUnknownParams = {
  periodId: number;
  employeeIds: number[];
  reason?: string;
};

export type MarkUnknownResult = {
  count: number;
};

export type WithdrawParams = {
  periodId: number;
  employeeIds: number[];
};

export type WithdrawResult = {
  count: number;
};

export type FieldError = {
  employeeId: number;
  name: string;
  itemCode?: string | null;
  message: string;
};

export type ScoringBizError = {
  errorCode?: number;
  errorMessage?: string;
  showType?: number;
  data?: {
    fieldErrors?: FieldError[];
  } | null;
};

export type LocalStatus =
  | 'submitted'
  | 'skipped'
  | 'done'
  | 'partial'
  | 'empty';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export type ApiResult<T> = {
  success: boolean;
  data: T;
  errorCode?: number;
  errorMessage?: string;
};
