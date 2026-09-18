import { request } from '@umijs/max';
import type { HistoryQueryParams, HistoryRecord, PeriodBrief } from './data.d';

export async function queryHistory(params: HistoryQueryParams) {
  const res = await request<{
    success: boolean;
    data: HistoryRecord[];
    total: number;
  }>('/api/evaluation/history', {
    method: 'GET',
    params: {
      periodId: params.periodId,
      current: params.current ?? 1,
      pageSize: params.pageSize ?? 20,
    },
  });
  return {
    data: res.data ?? [],
    total: res.total ?? 0,
    success: res.success !== false,
  };
}

export async function queryPeriodOptions() {
  const res = await request<{ success: boolean; data: PeriodBrief[]; total: number }>('/api/periods', {
    method: 'GET',
    params: { current: 1, pageSize: 100 },
  });
  return (res.data ?? []).map((item) => ({
    value: item.id,
    label: item.code,
  }));
}
