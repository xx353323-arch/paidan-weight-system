export const ROLE_LABEL: Record<string, string> = {
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

export const PERIOD_STATUS_VALUE_ENUM = {
  draft: { text: '草稿', status: 'Default' },
  open: { text: '进行中', status: 'Processing' },
  closed: { text: '已截止', status: 'Warning' },
  computed: { text: '已跑批', color: 'cyan' },
  published: { text: '已发布', status: 'Success' },
  archived: { text: '已归档', color: 'default' },
};

export const PERIOD_STATUS_TAG_COLOR: Record<string, string> = {
  draft: 'default',
  open: 'processing',
  closed: 'warning',
  computed: 'cyan',
  published: 'success',
  archived: 'default',
};

export const RATER_STATE_META: Record<
  string,
  { label: string; color: string }
> = {
  not_started: { label: '未开始', color: 'default' },
  in_progress: { label: '填写中', color: 'processing' },
  finished: { label: '已完成', color: 'success' },
};

export function formatPeriodTitle(code?: string | null) {
  if (!code) return '';
  const [year, month] = code.split('-');
  if (!year || !month) return code;
  return `${year}年${Number(month)}月`;
}

export function parseRaterKey(key: string) {
  const index = key.lastIndexOf(':');
  const name = index >= 0 ? key.slice(0, index) : key;
  const roleCode = index >= 0 ? key.slice(index + 1) : '';
  return { name, roleCode, roleLabel: ROLE_LABEL[roleCode] ?? roleCode };
}

export function toPercent(rate?: number | null) {
  if (!rate || Number.isNaN(rate)) return 0;
  return Math.round(rate * 1000) / 10;
}

export function bizMessage(error: unknown, fallback: string) {
  const info = (error as { info?: { errorMessage?: string } })?.info;
  return info?.errorMessage || fallback;
}
