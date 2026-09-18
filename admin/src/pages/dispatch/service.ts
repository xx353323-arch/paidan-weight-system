import { request } from '@umijs/max';
import type {
  DispatchTag,
  PeriodMeta,
  RankingItem,
  RankingQueryParams,
  ResultPeriodOption,
  ScoreDetail,
} from './data.d';

export async function queryRanking(params: RankingQueryParams, silent = false) {
  return request<PD.PageResponse<RankingItem>>('/api/weights', {
    method: 'GET',
    params,
    skipErrorHandler: silent,
  });
}

export async function fetchResultPeriods(): Promise<ResultPeriodOption[]> {
  try {
    const res = await request<PD.Response<ResultPeriodOption[]>>(
      '/api/weights/periods',
      { method: 'GET', skipErrorHandler: true },
    );
    return Array.isArray(res?.data) ? res.data : [];
  } catch {
    return [];
  }
}

export async function fetchPeriodMetaMap(): Promise<
  Record<number, PeriodMeta>
> {
  try {
    const res = await request<PD.PageResponse<PeriodMeta>>('/api/periods', {
      method: 'GET',
      params: { current: 1, pageSize: 100 },
      skipErrorHandler: true,
    });
    const list = Array.isArray(res?.data) ? res.data : [];
    return list.reduce<Record<number, PeriodMeta>>((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export async function fetchScoreDetail(employeeId: number, periodId?: number) {
  return request<PD.Response<ScoreDetail>>(`/api/weights/${employeeId}`, {
    method: 'GET',
    params: periodId ? { periodId } : undefined,
    skipErrorHandler: true,
  });
}

export async function fetchDispatchTags(): Promise<DispatchTag[]> {
  try {
    const res = await request<PD.Response<PD.Tag[]>>('/api/tags', {
      method: 'GET',
      skipErrorHandler: true,
    });
    const list = Array.isArray(res?.data) ? res.data : [];
    return list
      .filter((item) => item && item.isActive !== false)
      .map((item) => ({
        id: Number(item.id),
        name: String(item.name ?? ''),
        color: String(item.color ?? 'default'),
      }));
  } catch {
    return [];
  }
}
