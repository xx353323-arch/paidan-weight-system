import { request } from '@umijs/max';

export type BoardRow = {
  seat: number;
  groupRank: number | null;
  wFinal: number;
  gradeCode: string | null;
  gradeColor: string;
  isMe: boolean;
};

export type BoardGroup = {
  groupName: string;
  total: number;
  rows: BoardRow[];
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
  aheadOf: number;
};

export type BoardData = {
  period: { code: string; year: number; month: number } | null;
  groups: BoardGroup[];
  mine: MyPosition | null;
};

export async function queryBoard() {
  return request<{ success: boolean; data: BoardData }>('/api/board/ranking', {
    method: 'GET',
  });
}
