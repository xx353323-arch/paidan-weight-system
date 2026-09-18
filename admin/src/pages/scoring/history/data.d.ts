export type HistoryStatus = 'SUBMITTED' | 'UNKNOWN';

export type HistoryScoreItem = {
  label: string;
  score: number;
  comment?: string | null;
};

export type HistoryRecord = {
  id: number;
  periodId: number;
  periodCode: string;
  employeeId: number;
  employeeName: string;
  empNo: string;
  roleCode: string;
  roleLabel: string;
  familiarityLabel: string;
  rawScore?: number | null;
  status: HistoryStatus;
  submittedAt?: string | null;
  items: HistoryScoreItem[];
};

export type HistoryQueryParams = {
  periodId?: number;
  current?: number;
  pageSize?: number;
};

export type PeriodOption = {
  label: string;
  value: number;
};

export type PeriodBrief = {
  id: number;
  code: string;
  status: string;
  statusLabel: string;
};
