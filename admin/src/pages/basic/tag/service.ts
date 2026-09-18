import { request } from '@umijs/max';

export type TagRow = {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  isActive: boolean;
  isGroup: boolean;
  employeeCount: number;
};

export type TagPayload = {
  name: string;
  color: string;
  sortOrder: number;
};

export async function queryTags() {
  return request<PD.Response<TagRow[]>>('/api/tags', {
    method: 'GET',
    skipErrorHandler: true,
  });
}

export async function addTag(body: TagPayload) {
  return request<PD.Response<TagRow>>('/api/tags', {
    method: 'POST',
    data: body,
    skipErrorHandler: true,
  });
}

export async function editTag(
  id: number,
  body: Partial<TagPayload> & { isActive?: boolean; isGroup?: boolean },
) {
  return request<PD.Response<TagRow>>(`/api/tags/${id}`, {
    method: 'PUT',
    data: body,
    skipErrorHandler: true,
  });
}

export async function removeTag(id: number) {
  return request<PD.Response<boolean>>(`/api/tags/${id}`, {
    method: 'DELETE',
    skipErrorHandler: true,
  });
}

export async function switchTagActive(id: number) {
  return request<PD.Response<TagRow>>(`/api/tags/${id}/toggle`, {
    method: 'PUT',
    skipErrorHandler: true,
  });
}

export function bizMessage(error: unknown, fallback: string) {
  const info = (error as { info?: { errorMessage?: string } })?.info;
  return info?.errorMessage || fallback;
}
