import type { Dayjs } from 'dayjs';

export type PeriodStatus =
  | 'draft'
  | 'open'
  | 'closed'
  | 'computed'
  | 'published'
  | 'archived';

export type PeriodItem = {
  id: number;
  code: string;
  year: number;
  month: number;
  status: PeriodStatus;
  statusLabel: string;
  openAt?: string | null;
  closeAt?: string | null;
  publishedAt?: string | null;
  configId?: number | null;
  createdBy?: number | null;
  createdByName?: string | null;
  createdAt?: string | null;
  taskTotal: number;
  taskDone: number;
  taskRate: number;
};

export type PeriodQueryParams = {
  current?: number;
  pageSize?: number;
};

export type PeriodCreatePayload = {
  code: string;
  openAt?: string | null;
  closeAt?: string | null;
};

export type PeriodTimePayload = {
  openAt?: string | null;
  closeAt?: string | null;
};

export type PeriodFormValues = {
  code?: string;
  month?: Dayjs | string;
  range?: [Dayjs | string, Dayjs | string] | null;
};

export type UncoveredEmployee = {
  employeeId: number;
  name: string;
};

export type MaterializeResult = {
  taskCount: number;
  employeeCount: number;
  raterCount: number;
  perRater: Record<string, number>;
  uncoveredEmployees: UncoveredEmployee[];
};

export type OpenPeriodResult = MaterializeResult & {
  period: PeriodItem;
};

export type ClosePeriodResult = {
  expiredCount: number;
  period: PeriodItem;
};

export type ReopenPeriodResult = {
  restoredCount: number;
  period: PeriodItem;
};
