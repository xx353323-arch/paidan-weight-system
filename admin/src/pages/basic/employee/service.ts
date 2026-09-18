import { request } from '@umijs/max';
import type {
  ApiResult,
  EmployeeBatchTagValues,
  EmployeeFormValues,
  EmployeeItem,
  EmployeeQueryParams,
  EmployeeStatusValues,
  PageResult,
  SelectOption,
} from './data.d';

export async function queryEmployees(params: EmployeeQueryParams) {
  return request<PageResult<EmployeeItem>>('/api/employees', {
    method: 'GET',
    params,
  });
}

export async function createEmployee(data: EmployeeFormValues) {
  return request<ApiResult<EmployeeItem>>('/api/employees', {
    method: 'POST',
    data,
  });
}

export async function updateEmployee(id: number, data: EmployeeFormValues) {
  return request<ApiResult<EmployeeItem>>(`/api/employees/${id}`, {
    method: 'PUT',
    data,
  });
}

export async function updateEmployeeStatus(
  id: number,
  data: EmployeeStatusValues,
) {
  return request<ApiResult<EmployeeItem>>(`/api/employees/${id}/status`, {
    method: 'PUT',
    data,
  });
}

export async function batchTagEmployees(data: EmployeeBatchTagValues) {
  return request<ApiResult<{ updated: number }>>('/api/employees/batch-tag', {
    method: 'PUT',
    data,
  });
}

export async function fetchLeadOptions(): Promise<SelectOption[]> {
  try {
    const res = await request<ApiResult<SelectOption[]>>(
      '/api/employees/lead-options',
      { method: 'GET', skipErrorHandler: true },
    );
    return Array.isArray(res?.data) ? res.data : [];
  } catch {
    return [];
  }
}

export async function fetchTagOptions(): Promise<SelectOption[]> {
  try {
    const res = await request<Record<string, any>>('/api/tags', {
      method: 'GET',
      skipErrorHandler: true,
    });
    const list = Array.isArray(res?.data) ? res.data : [];
    return list
      .filter((item: any) => item && item.id !== undefined)
      .map((item: any) => ({
        label: String(item.name ?? item.label ?? ''),
        value: Number(item.id ?? item.value),
      }));
  } catch {
    return [];
  }
}

export async function fetchActiveTagOptions(): Promise<SelectOption[]> {
  try {
    const res = await request<Record<string, any>>('/api/tags', {
      method: 'GET',
      skipErrorHandler: true,
    });
    const list = Array.isArray(res?.data) ? res.data : [];
    return list
      .filter((item: any) => item && item.id !== undefined && item.isActive !== false)
      .map((item: any) => ({
        label: String(item.name ?? item.label ?? ''),
        value: Number(item.id ?? item.value),
      }));
  } catch {
    return [];
  }
}
