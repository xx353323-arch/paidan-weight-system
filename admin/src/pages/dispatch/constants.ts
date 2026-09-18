export const DISPATCH_QUERY_KEY = 'dispatch-ranking';

export const RANKING_PAGE_SIZE = 200;

export const TIE_HINT = '同权重，请按擅长领域挑选';

export const GRADE_META: Record<string, { color: string; desc: string }> = {
  S: { color: 'green', desc: '90 分以上' },
  A: { color: 'cyan', desc: '80 到 89 分' },
  B: { color: 'blue', desc: '70 到 79 分' },
  C: { color: 'orange', desc: '60 到 69 分' },
  D: { color: 'red', desc: '60 分以下' },
};

export const GRADE_OPTIONS = [
  { label: '全部', value: 'ALL' },
  { label: 'S', value: 'S' },
  { label: 'A', value: 'A' },
  { label: 'B', value: 'B' },
  { label: 'C', value: 'C' },
  { label: 'D', value: 'D' },
];

export const COVERAGE_META: Record<string, { color: string; risky: boolean }> =
  {
    HIGH: { color: 'green', risky: false },
    MEDIUM: { color: 'blue', risky: false },
    LOW: { color: 'orange', risky: true },
    THIN: { color: 'red', risky: true },
    NONE: { color: 'red', risky: true },
  };

export const EMPLOYMENT_STATUS_META: Record<
  string,
  { text: string; color: string }
> = {
  probation: { text: '试用', color: 'gold' },
  regular: { text: '在职', color: 'green' },
  leaving: { text: '离职中', color: 'blue' },
  left: { text: '已离职', color: 'default' },
  suspended: { text: '停职', color: 'red' },
};

export const ROLE_ORDER = ['editor_lead', 'delivery', 'cs', 'hr'];

export const ROLE_FALLBACK_LABEL: Record<string, string> = {
  editor_lead: '直属编辑主管',
  delivery: '交付对接',
  cs: '客服主管',
  hr: '人事主管',
};

export const ROLE_BAR_COLOR: Record<string, string> = {
  editor_lead: '#1677ff',
  delivery: '#13c2c2',
  cs: '#fa8c16',
  hr: '#722ed1',
};

export const ADJUST_TYPE_LABEL: Record<string, string> = {
  FREEZE: '冻结分数',
  OVERRIDE: '直接覆盖',
  MULTIPLIER: '系数缩放',
  DELTA: '加减分',
};

export function formatScore(value?: number | null, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return value.toFixed(digits);
}

export function formatPercent(value?: number | null, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDelta(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return '';
  return value.replace('T', ' ').slice(0, 16);
}

export function gradeColor(code?: string | null) {
  return GRADE_META[code ?? '']?.color ?? 'default';
}

export function coverageColor(level?: string | null) {
  return COVERAGE_META[level ?? '']?.color ?? 'default';
}
