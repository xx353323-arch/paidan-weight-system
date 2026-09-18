import { request } from '@umijs/max';
import { formatPeriodTitle } from './constants';
import type {
  AdjustmentCreatePayload,
  AdjustmentCreateResult,
  AdjustmentItem,
  AdjustmentQueryParams,
  EmployeeScore,
  PeriodOption,
  PreviewPayload,
  PreviewResult,
  SelectOption,
} from './data.d';

export async function queryAdjustments(params: AdjustmentQueryParams) {
  return request<PD.PageResponse<AdjustmentItem>>('/api/adjustments', {
    method: 'GET',
    params,
  });
}

export async function createAdjustment(data: AdjustmentCreatePayload) {
  return request<PD.Response<AdjustmentCreateResult>>('/api/adjustments', {
    method: 'POST',
    data,
    skipErrorHandler: true,
  });
}

export async function revokeAdjustment(id: number, reason: string) {
  return request<PD.Response<AdjustmentItem>>(`/api/adjustments/${id}/revoke`, {
    method: 'POST',
    data: { reason },
    skipErrorHandler: true,
  });
}

export async function previewAdjustment(data: PreviewPayload) {
  return request<PD.Response<PreviewResult>>('/api/adjustments/preview', {
    method: 'POST',
    data,
    skipErrorHandler: true,
  });
}

export async function fetchEmployeeOptions(): Promise<SelectOption[]> {
  try {
    const res = await request<PD.Response<SelectOption[]>>(
      '/api/employees/options',
      { method: 'GET', skipErrorHandler: true },
    );
    const list = Array.isArray(res?.data) ? res.data : [];
    return list.map((item) => ({
      value: Number(item.value),
      label: item.empNo ? `${item.label}（${item.empNo}）` : String(item.label),
      empNo: item.empNo,
    }));
  } catch {
    return [];
  }
}

export async function fetchPeriodOptions(): Promise<PeriodOption[]> {
  try {
    const res = await request<Record<string, any>>('/api/periods', {
      method: 'GET',
      params: { current: 1, pageSize: 100 },
      skipErrorHandler: true,
    });
    const list = Array.isArray(res?.data) ? res.data : [];
    return list.map((item: any) => ({
      value: Number(item.id),
      label: formatPeriodTitle(item.code),
      code: String(item.code),
      status: String(item.status),
    }));
  } catch {
    return [];
  }
}

export async function fetchEmployeeScores(): Promise<
  Record<number, EmployeeScore>
> {
  try {
    const res = await request<Record<string, any>>('/api/weights', {
      method: 'GET',
      params: { current: 1, pageSize: 500 },
      skipErrorHandler: true,
    });
    const list = Array.isArray(res?.data) ? res.data : [];
    const map: Record<number, EmployeeScore> = {};
    list.forEach((item: any) => {
      map[Number(item.employeeId)] = {
        employeeId: Number(item.employeeId),
        name: String(item.name ?? ''),
        rankNo: item.rankNo ?? null,
        wFinal: Number(item.wFinal ?? 0),
        gradeCode: item.gradeCode ?? null,
      };
    });
    return map;
  } catch {
    return {};
  }
}
