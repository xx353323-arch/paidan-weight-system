export const WORKBENCH_QUERY_KEY = 'workbench';

export const DAY_MS = 24 * 60 * 60 * 1000;

export const ROLE_LABEL: Record<string, string> = {
  admin: '管理员',
  editor_lead: '编辑主管',
  delivery: '交付',
  cs: '客服',
  hr: '人事',
};

export const ROLE_COLOR: Record<string, string> = {
  editor_lead: 'blue',
  delivery: 'green',
  cs: 'orange',
  hr: 'purple',
};

export const PERIOD_STATUS_TAG_COLOR: Record<string, string> = {
  draft: 'default',
  open: 'processing',
  closed: 'warning',
  computed: 'cyan',
  published: 'success',
  archived: 'default',
};

export const GRADE_META: Record<string, { color: string; range: string }> = {
  S: { color: 'magenta', range: '90 分以上' },
  A: { color: 'green', range: '80 到 89 分' },
  B: { color: 'blue', range: '70 到 79 分' },
  C: { color: 'orange', range: '60 到 69 分' },
  D: { color: 'default', range: '60 分以下' },
};

export const RANK_COLOR: Record<number, string> = {
  1: '#d48806',
  2: '#8c8c8c',
  3: '#ad4e00',
};

export function greetingOf(hour: number) {
  if (hour < 12) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function formatPeriodTitle(code?: string | null) {
  if (!code) return '';
  const [year, month] = code.split('-');
  if (!year || !month) return code;
  return `${year}年${Number(month)}月`;
}

export function toPercent(rate?: number | null) {
  if (!rate || Number.isNaN(rate)) return 0;
  return Math.round(rate * 1000) / 10;
}

export function formatRemain(remain: number) {
  const totalSeconds = Math.floor(remain / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  if (days > 0)
    return `${days} 天 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatClock(value?: string | null) {
  if (!value) return '';
  return value.replace('T', ' ').slice(0, 16);
}

export function bizMessage(error: unknown, fallback: string) {
  const info = (error as { info?: { errorMessage?: string } })?.info;
  return info?.errorMessage || fallback;
}
