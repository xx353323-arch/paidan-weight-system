import { request } from '@umijs/max';
import type {
  EvaluateOverview,
  PeriodInfo,
  PeriodProgress,
  RankingItem,
} from './data.d';

export async function fetchCurrentPeriod(): Promise<PeriodInfo | null> {
  const res = await request<PD.Response<PeriodInfo | null>>(
    '/api/periods/current',
    { method: 'GET', skipErrorHandler: true },
  );
  return res?.data ?? null;
}

export async function fetchEvaluateOverview(): Promise<EvaluateOverview> {
  const res = await request<PD.Response<EvaluateOverview>>(
    '/api/evaluation/tasks',
    { method: 'GET', skipErrorHandler: true },
  );
  return res.data;
}

export async function fetchTopRanking(pageSize = 10): Promise<RankingItem[]> {
  const res = await request<PD.PageResponse<RankingItem>>('/api/weights', {
    method: 'GET',
    params: { current: 1, pageSize },
    skipErrorHandler: true,
  });
  return Array.isArray(res?.data) ? res.data : [];
}

export async function fetchPeriodProgress(
  periodId: number,
): Promise<PeriodProgress> {
  const res = await request<PD.Response<PeriodProgress>>(
    `/api/periods/${periodId}/progress`,
    { method: 'GET', skipErrorHandler: true },
  );
  return res.data;
}
