import { request } from '@umijs/max';
import type { PeriodProgressResult } from './data.d';

export async function fetchPeriodProgress(id: number) {
  return request<PD.Response<PeriodProgressResult>>(
    `/api/periods/${id}/progress`,
    {
      method: 'GET',
      skipErrorHandler: true,
    },
  );
}
