import { request } from '@umijs/max';
import type {
  CopyFromLastResult,
  CoverageCheckResult,
  MatrixResult,
  RaterItem,
  SaveTargetsParams,
  SaveTargetsResult,
  TargetsResult,
} from './data.d';

export async function fetchRaters() {
  return request<PD.Response<RaterItem[]>>('/api/relations/raters', {
    method: 'GET',
  });
}

export async function fetchTargets(raterUserId: number, roleCode: string) {
  return request<PD.Response<TargetsResult>>(
    `/api/relations/${raterUserId}/targets`,
    {
      method: 'GET',
      params: { roleCode },
    },
  );
}

export async function saveTargets(
  raterUserId: number,
  body: SaveTargetsParams,
) {
  return request<PD.Response<SaveTargetsResult>>(
    `/api/relations/${raterUserId}/targets`,
    {
      method: 'PUT',
      data: body,
      skipErrorHandler: true,
    },
  );
}

export async function fetchMatrix() {
  return request<PD.Response<MatrixResult>>('/api/relations/matrix', {
    method: 'GET',
  });
}

export async function fetchCoverageCheck() {
  return request<PD.Response<CoverageCheckResult>>(
    '/api/relations/coverage-check',
    {
      method: 'GET',
    },
  );
}

export async function copyFromLast() {
  return request<PD.Response<CopyFromLastResult>>(
    '/api/relations/copy-from-last',
    {
      method: 'POST',
      data: { confirm: true },
    },
  );
}
