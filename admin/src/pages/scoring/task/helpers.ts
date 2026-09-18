import {
  FAMILIARITY_ERROR_KEY,
  MIN_COMMENT_LENGTH,
  SERVER_FAMILIARITY_FIELD,
} from './constants';
import type {
  DraftRecord,
  FamiliarityOption,
  FieldError,
  LocalStatus,
  ScoringItem,
  ScoringTarget,
} from './data.d';

export function recordFromTarget(target: ScoringTarget): DraftRecord {
  return {
    employeeId: target.employeeId,
    familiarityCode: target.familiarityCode ?? null,
    scores: { ...(target.scores ?? {}) },
    comments: { ...(target.comments ?? {}) },
    overallComment: target.overallComment ?? null,
  };
}

export function emptyRecord(employeeId: number): DraftRecord {
  return {
    employeeId,
    familiarityCode: null,
    scores: {},
    comments: {},
    overallComment: null,
  };
}

export function normalizeErrorCode(itemCode?: string | null) {
  if (!itemCode || itemCode === SERVER_FAMILIARITY_FIELD)
    return FAMILIARITY_ERROR_KEY;
  return itemCode;
}

export function findFamiliarity(
  options: FamiliarityOption[],
  code?: string | null,
) {
  if (!code) return undefined;
  return options.find((item) => item.code === code);
}

export function unknownOption(options: FamiliarityOption[]) {
  return options.find((item) => item.isUnknown);
}

export function isUnknownSelected(
  options: FamiliarityOption[],
  code?: string | null,
) {
  return Boolean(findFamiliarity(options, code)?.isUnknown);
}

export function hasAnyInput(record?: DraftRecord) {
  if (!record) return false;
  if (record.familiarityCode) return true;
  if (Object.keys(record.scores ?? {}).length > 0) return true;
  if (
    Object.values(record.comments ?? {}).some(
      (text) => (text ?? '').trim().length > 0,
    )
  )
    return true;
  return Boolean((record.overallComment ?? '').trim());
}

export function commentRequired(item: ScoringItem, score?: number) {
  if (score === undefined || score === null) return false;
  return score < item.commentRequiredBelow;
}

export function validateRecord(
  target: ScoringTarget,
  record: DraftRecord | undefined,
  items: ScoringItem[],
  options: FamiliarityOption[],
): FieldError[] {
  const errors: FieldError[] = [];
  if (!record?.familiarityCode) {
    errors.push({
      employeeId: target.employeeId,
      name: target.name,
      itemCode: null,
      message: '尚未选择熟悉程度',
    });
    return errors;
  }
  if (isUnknownSelected(options, record.familiarityCode)) return errors;
  items.forEach((item) => {
    const score = record.scores?.[item.code];
    if (score === undefined || score === null) {
      errors.push({
        employeeId: target.employeeId,
        name: target.name,
        itemCode: item.code,
        message: `${item.label} 尚未打分`,
      });
      return;
    }
    if (!commentRequired(item, score)) return;
    const text = (record.comments?.[item.code] ?? '').trim();
    if (text.length < MIN_COMMENT_LENGTH) {
      errors.push({
        employeeId: target.employeeId,
        name: target.name,
        itemCode: item.code,
        message: `${item.label} 只给 ${score} 分，需要填写不少于 ${MIN_COMMENT_LENGTH} 个字的说明`,
      });
    }
  });
  return errors;
}

export function computeLocalStatus(
  target: ScoringTarget,
  record: DraftRecord | undefined,
  items: ScoringItem[],
  options: FamiliarityOption[],
): LocalStatus {
  if (target.status === 'SUBMITTED') return 'submitted';
  if (isUnknownSelected(options, record?.familiarityCode)) return 'skipped';
  if (!hasAnyInput(record)) return 'empty';
  return validateRecord(target, record, items, options).length > 0
    ? 'partial'
    : 'done';
}

export function groupByLead(targets: ScoringTarget[]) {
  const buckets = new Map<
    string,
    {
      key: string;
      leadUserId: number | null;
      leadName: string;
      rows: ScoringTarget[];
    }
  >();
  targets.forEach((target) => {
    const leadUserId = target.leadUserId ?? null;
    const key = leadUserId === null ? 'none' : String(leadUserId);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        leadUserId,
        leadName: target.leadName ?? '未归属主管',
        rows: [],
      });
    }
    buckets.get(key)?.rows.push(target);
  });
  return Array.from(buckets.values()).sort((a, b) => {
    if (a.leadUserId === null) return 1;
    if (b.leadUserId === null) return -1;
    if (b.rows.length !== a.rows.length) return b.rows.length - a.rows.length;
    return a.leadName.localeCompare(b.leadName, 'zh-Hans-CN');
  });
}

export function formatWeight(weight: number) {
  return `${Math.round(weight * 100)}%`;
}

export function formatClock(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function latestUpdatedAt(targets: ScoringTarget[]) {
  let latest = 0;
  targets.forEach((target) => {
    if (!target.updatedAt) return;
    const time = new Date(target.updatedAt).getTime();
    if (!Number.isNaN(time) && time > latest) latest = time;
  });
  return latest;
}
