import type { LocalStatus } from './data.d';

export const SCORING_TASK_QUERY_KEY = 'scoring-task';

export const SCORE_RANGE = [1, 2, 3, 4, 5];

export const MIN_COMMENT_LENGTH = 10;

export const FAMILIARITY_ERROR_KEY = '__familiarity__';

export const SERVER_FAMILIARITY_FIELD = 'familiarity';

export const AUTO_SAVE_DELAY = 800;

export const LAYOUT_HEADER_OFFSET = 56;

export const SCORE_TONE: Record<number, string> = {
  1: '#cf1322',
  2: '#d4380d',
  3: '#d48806',
  4: '#52c41a',
  5: '#237804',
};

export const SCORE_HINT: Record<number, string> = {
  1: '1 分 明显低于要求',
  2: '2 分 低于预期',
  3: '3 分 符合常规要求',
  4: '4 分 好于预期',
  5: '5 分 稳定优秀',
};

export const LOCAL_STATUS_META: Record<
  LocalStatus,
  { label: string; color: string; order: number }
> = {
  empty: { label: '未开始', color: '#8c8c8c', order: 1 },
  partial: { label: '填写中', color: '#1677ff', order: 2 },
  done: { label: '待提交', color: '#52c41a', order: 3 },
  skipped: { label: '已跳过', color: '#bfbfbf', order: 4 },
  submitted: { label: '已提交', color: '#389e0d', order: 5 },
};

export const NAV_GROUP_ORDER: LocalStatus[] = [
  'empty',
  'partial',
  'done',
  'submitted',
  'skipped',
];

export const COMMENT_PLACEHOLDER =
  '请写清具体事例，例如：本月两次交稿超期，第二次晚 3 天';

export const FAMILIARITY_TIP =
  '越熟悉，你的打分在合并时权重越高。选择不了解将跳过此人，不计入他的综合得分。';

export function buildLocalDraftKey(periodId: number, userId: string) {
  return `paidan:scoring-draft:${periodId}:${userId}`;
}
