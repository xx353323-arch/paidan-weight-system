import type { PeriodItem } from '../list/data.d';

export type RaterState = 'not_started' | 'in_progress' | 'finished';

export type ProgressRaterItem = {
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

export type PeriodProgressResult = {
  items: ProgressRaterItem[];
  summary: ProgressSummary;
  period: PeriodItem;
};
