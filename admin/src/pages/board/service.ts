import { request } from '@umijs/max';

export type BoardRow = {
  groupRank: number | null;
  maskedName: string;
  wFinal: number;
  gradeCode: string | null;
  gradeColor: string;
};

export type BoardGroup = {
  groupName: string;
  total: number;
  rows: BoardRow[];
};

export type BoardData = {
  period: { code: string; year: number; month: number } | null;
  groups: BoardGroup[];
  publishedAt: string | null;
};

export type MyPosition = {
  name: string;
  empNo: string;
  groupName: string;
  groupRank: number | null;
  groupTotal: number;
  wFinal: number;
  gradeCode: string | null;
  gradeColor: string;
  isFrozen: boolean;
  aheadOf: number;
  periodCode: string;
};

export async function queryBoard() {
  return request<{ success: boolean; data: BoardData }>('/api/public/ranking', {
    method: 'GET',
    skipErrorHandler: true,
  });
}

export async function lookupMine(keyword: string) {
  return request<{ success: boolean; data: MyPosition; errorMessage?: string }>(
    '/api/public/lookup',
    { method: 'GET', params: { keyword }, skipErrorHandler: true },
  );
}
