import { request } from '@umijs/max';
import type {
  ClosePeriodResult,
  MaterializeResult,
  OpenPeriodResult,
  PeriodCreatePayload,
  PeriodItem,
  PeriodQueryParams,
  PeriodTimePayload,
  ReopenPeriodResult,
} from './data.d';

export async function queryPeriods(params: PeriodQueryParams) {
  return request<PD.PageResponse<PeriodItem>>('/api/periods', {
    method: 'GET',
    params,
  });
}

export async function fetchCurrentPeriod() {
  return request<PD.Response<PeriodItem | null>>('/api/periods/current', {
    method: 'GET',
    skipErrorHandler: true,
  });
}

export async function createPeriod(data: PeriodCreatePayload) {
  return request<PD.Response<PeriodItem>>('/api/periods', {
    method: 'POST',
    data,
    skipErrorHandler: true,
  });
}

export async function updatePeriodTime(id: number, data: PeriodTimePayload) {
  return request<PD.Response<PeriodItem>>(`/api/periods/${id}`, {
    method: 'PUT',
    data,
    skipErrorHandler: true,
  });
}

export async function openPeriod(id: number) {
  return request<PD.Response<OpenPeriodResult>>(`/api/periods/${id}/open`, {
    method: 'POST',
    skipErrorHandler: true,
  });
}

export async function syncPeriodTasks(id: number) {
  return request<PD.Response<MaterializeResult>>(
    `/api/periods/${id}/sync-tasks`,
    {
      method: 'POST',
      skipErrorHandler: true,
    },
  );
}

export async function closePeriod(id: number) {
  return request<PD.Response<ClosePeriodResult>>(`/api/periods/${id}/close`, {
    method: 'POST',
    skipErrorHandler: true,
  });
}

export async function reopenPeriod(id: number) {
  return request<PD.Response<ReopenPeriodResult>>(`/api/periods/${id}/reopen`, {
    method: 'POST',
    skipErrorHandler: true,
  });
}
