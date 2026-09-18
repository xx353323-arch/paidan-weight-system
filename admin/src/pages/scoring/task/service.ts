import { request } from '@umijs/max';
import type {
  ApiResult,
  MarkUnknownParams,
  MarkUnknownResult,
  SaveDraftParams,
  SaveDraftResult,
  ScoringBizError,
  ScoringTaskResult,
  SubmitResult,
  WithdrawParams,
  WithdrawResult,
} from './data.d';

export function readBizError(error: unknown): ScoringBizError {
  const info = (error as { info?: ScoringBizError })?.info;
  return info ?? {};
}

export async function fetchScoringTask(
  periodId?: number,
): Promise<ScoringTaskResult> {
  const res = await request<ApiResult<ScoringTaskResult>>(
    '/api/evaluation/tasks',
    {
      method: 'GET',
      params: periodId ? { periodId } : undefined,
      skipErrorHandler: true,
    },
  );
  return res.data;
}

export async function saveScoringDraft(
  params: SaveDraftParams,
): Promise<SaveDraftResult> {
  const res = await request<ApiResult<SaveDraftResult>>(
    '/api/evaluation/draft',
    { method: 'PUT', data: params, skipErrorHandler: true },
  );
  return res.data;
}

export async function submitScoring(
  params: SaveDraftParams,
): Promise<SubmitResult> {
  const res = await request<ApiResult<SubmitResult>>('/api/evaluation/submit', {
    method: 'POST',
    data: params,
    skipErrorHandler: true,
  });
  return res.data;
}

export async function markUnknown(
  params: MarkUnknownParams,
): Promise<MarkUnknownResult> {
  const res = await request<ApiResult<MarkUnknownResult>>(
    '/api/evaluation/unknown',
    { method: 'POST', data: params, skipErrorHandler: true },
  );
  return res.data;
}

export async function withdrawScoring(
  params: WithdrawParams,
): Promise<WithdrawResult> {
  const res = await request<ApiResult<WithdrawResult>>(
    '/api/evaluation/withdraw',
    { method: 'POST', data: params, skipErrorHandler: true },
  );
  return res.data;
}
