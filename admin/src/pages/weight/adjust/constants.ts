import type { AdjustType } from './data.d';

export const ADJUST_TYPE_VALUE_ENUM = {
  MULTIPLIER: { text: '乘数', color: 'blue' },
  DELTA: { text: '加减分', color: 'green' },
  OVERRIDE: { text: '绝对覆盖', color: 'orange' },
  FREEZE: { text: '冻结', color: 'red' },
};

export const ADJUST_TYPE_COLOR: Record<AdjustType, string> = {
  MULTIPLIER: 'blue',
  DELTA: 'green',
  OVERRIDE: 'orange',
  FREEZE: 'red',
};

export const ADJUST_TYPE_OPTIONS = [
  { label: '乘数', value: 'MULTIPLIER' },
  { label: '加减分', value: 'DELTA' },
  { label: '绝对覆盖', value: 'OVERRIDE' },
  { label: '冻结', value: 'FREEZE' },
];

export const ADJUST_TYPE_HINT: Record<AdjustType, string> = {
  MULTIPLIER:
    '最终分乘以该系数，同期多个乘数连乘，之后再叠加加减分，结果限制在 0 到 100 分之间。',
  DELTA:
    '在乘数生效之后加上或减去固定分值，同期多条加减分累加，结果限制在 0 到 100 分之间。',
  OVERRIDE:
    '直接指定最终分，该员工同期的乘数与加减分全部作废。同期存在多条绝对覆盖时以最后创建的一条为准。',
  FREEZE:
    '冻结后该员工最终分记 0，退出派单池，不参与排名。优先级最高，同期其他调整全部作废。',
};

export const ADJUST_STATUS_VALUE_ENUM = {
  active: { text: '生效中', status: 'Success' },
  revoked: { text: '已撤销', status: 'Default' },
  expired: { text: '已过期', status: 'Default' },
};

export const GRADE_COLOR: Record<string, string> = {
  S: 'gold',
  A: 'green',
  B: 'blue',
  C: 'orange',
  D: 'red',
  F: 'default',
};

export const ADJUST_QUERY_KEY = 'weight-adjust';

export function formatPeriodTitle(code?: string | null) {
  if (!code) return '';
  const [year, month] = code.split('-');
  if (!year || !month) return code;
  return `${year}年${Number(month)}月`;
}

export function formatGrade(code?: string | null) {
  if (!code) return '未定档';
  return code === 'F' ? '已冻结' : `${code}档`;
}

export function formatRank(rank?: number | null) {
  return rank ? `第${rank}名` : '不参与排名';
}

export function formatScore(value?: number | null) {
  if (value === undefined || value === null) return '—';
  return value.toFixed(2);
}

export function bizMessage(error: unknown, fallback: string) {
  const info = (error as { info?: { errorMessage?: string } })?.info;
  return info?.errorMessage || fallback;
}
