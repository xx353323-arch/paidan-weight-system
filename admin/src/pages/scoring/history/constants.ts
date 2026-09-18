export const HISTORY_STATUS_VALUE_ENUM = {
  SUBMITTED: { text: '已提交', status: 'Success' },
  UNKNOWN: { text: '已跳过', status: 'Default' },
};

export const SCORE_TONE: Record<number, string> = {
  1: '#cf1322',
  2: '#d4380d',
  3: '#d48806',
  4: '#52c41a',
  5: '#237804',
};

export const SCORE_TEXT: Record<number, string> = {
  1: '明显低于要求',
  2: '低于预期',
  3: '符合常规要求',
  4: '好于预期',
  5: '稳定优秀',
};

export const UNKNOWN_TEXT = '已标记为不了解';

export const UNKNOWN_HINT =
  '这次评价标记为不了解，不计入该编辑本期的综合得分。';

export function formatPeriodTitle(code?: string | null) {
  if (!code) return '';
  const [year, month] = code.split('-');
  if (!year || !month) return code;
  return `${year}年${Number(month)}月`;
}

export function formatClock(value?: string | null) {
  if (!value) return '';
  return value.replace('T', ' ').slice(0, 19);
}

export function formatScore(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return value.toFixed(2);
}
