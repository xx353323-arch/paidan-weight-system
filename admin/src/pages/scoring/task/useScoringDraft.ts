import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTO_SAVE_DELAY, buildLocalDraftKey } from './constants';
import type { DraftRecord, SaveState, ScoringTaskResult } from './data.d';
import { emptyRecord, recordFromTarget } from './helpers';
import { saveScoringDraft } from './service';

type LocalMirror = {
  periodId: number;
  userId: string;
  savedAt: number;
  dirty: boolean;
  records: DraftRecord[];
};

type UseScoringDraftArgs = {
  task?: ScoringTaskResult;
  userId: string;
};

function readMirror(periodId: number, userId: string): LocalMirror | null {
  try {
    const raw = window.localStorage.getItem(
      buildLocalDraftKey(periodId, userId),
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalMirror;
    if (!parsed || parsed.periodId !== periodId || parsed.userId !== userId)
      return null;
    if (!Array.isArray(parsed.records)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeMirror(mirror: LocalMirror) {
  try {
    window.localStorage.setItem(
      buildLocalDraftKey(mirror.periodId, mirror.userId),
      JSON.stringify(mirror),
    );
  } catch {
    return;
  }
}

function clearMirror(periodId: number, userId: string) {
  try {
    window.localStorage.removeItem(buildLocalDraftKey(periodId, userId));
  } catch {
    return;
  }
}

export function useScoringDraft({ task, userId }: UseScoringDraftArgs) {
  const [records, setRecords] = useState<Record<number, DraftRecord>>({});
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [recovery, setRecovery] = useState<LocalMirror | null>(null);

  const recordsRef = useRef<Record<number, DraftRecord>>({});
  const dirtyRef = useRef<Set<number>>(new Set());
  const timersRef = useRef<Map<number, number>>(new Map());
  const periodRef = useRef<number>(0);
  const userRef = useRef<string>(userId);

  userRef.current = userId;
  periodRef.current = task?.period?.id ?? 0;

  const mirror = useCallback((dirty: boolean, stamp: number) => {
    if (!periodRef.current || !userRef.current) return;
    writeMirror({
      periodId: periodRef.current,
      userId: userRef.current,
      savedAt: stamp,
      dirty,
      records: Object.values(recordsRef.current),
    });
  }, []);

  const commit = useCallback((next: Record<number, DraftRecord>) => {
    recordsRef.current = next;
    setRecords(next);
  }, []);

  const flush = useCallback(async () => {
    const ids = Array.from(dirtyRef.current);
    if (ids.length === 0 || !periodRef.current) return;
    timersRef.current.forEach((timer) => {
      window.clearTimeout(timer);
    });
    timersRef.current.clear();
    dirtyRef.current.clear();
    setPendingCount(0);
    setSaveState('saving');
    const payload = ids
      .map((id) => recordsRef.current[id])
      .filter(Boolean)
      .map((record) => ({
        employeeId: record.employeeId,
        familiarityCode: record.familiarityCode ?? null,
        scores: record.scores ?? {},
        comments: record.comments ?? {},
        overallComment: record.overallComment ?? null,
      }));
    try {
      await saveScoringDraft({ periodId: periodRef.current, records: payload });
      const stamp = Date.now();
      setSavedAt(stamp);
      setSaveState('saved');
      mirror(dirtyRef.current.size > 0, stamp);
    } catch {
      ids.forEach((id) => {
        dirtyRef.current.add(id);
      });
      setPendingCount(dirtyRef.current.size);
      setSaveState('error');
      mirror(true, Date.now());
    }
  }, [mirror]);

  const schedule = useCallback(
    (ids: number[]) => {
      ids.forEach((id) => {
        dirtyRef.current.add(id);
        const existing = timersRef.current.get(id);
        if (existing) window.clearTimeout(existing);
        timersRef.current.set(
          id,
          window.setTimeout(() => {
            timersRef.current.delete(id);
            void flush();
          }, AUTO_SAVE_DELAY),
        );
      });
      setPendingCount(dirtyRef.current.size);
      mirror(true, Date.now());
    },
    [flush, mirror],
  );

  const patch = useCallback(
    (employeeId: number, updater: (record: DraftRecord) => DraftRecord) => {
      const current = recordsRef.current[employeeId] ?? emptyRecord(employeeId);
      const next = { ...recordsRef.current, [employeeId]: updater(current) };
      commit(next);
      schedule([employeeId]);
    },
    [commit, schedule],
  );

  const setFamiliarity = useCallback(
    (employeeId: number, code: string | null, clearScores: boolean) =>
      patch(employeeId, (record) => ({
        ...record,
        familiarityCode: code,
        scores: clearScores ? {} : record.scores,
        comments: clearScores ? {} : record.comments,
        overallComment: clearScores ? null : record.overallComment,
      })),
    [patch],
  );

  const setScore = useCallback(
    (employeeId: number, itemCode: string, score: number, threshold: number) =>
      patch(employeeId, (record) => {
        const comments = { ...record.comments };
        if (score >= threshold) delete comments[itemCode];
        return {
          ...record,
          scores: { ...record.scores, [itemCode]: score },
          comments,
        };
      }),
    [patch],
  );

  const setComment = useCallback(
    (employeeId: number, itemCode: string, text: string) =>
      patch(employeeId, (record) => ({
        ...record,
        comments: { ...record.comments, [itemCode]: text },
      })),
    [patch],
  );

  const setOverallComment = useCallback(
    (employeeId: number, text: string) =>
      patch(employeeId, (record) => ({ ...record, overallComment: text })),
    [patch],
  );

  const resetFromServer = useCallback(
    (source: ScoringTaskResult) => {
      timersRef.current.forEach((timer) => {
        window.clearTimeout(timer);
      });
      timersRef.current.clear();
      dirtyRef.current.clear();
      setPendingCount(0);
      const next: Record<number, DraftRecord> = {};
      source.targets.forEach((target) => {
        next[target.employeeId] = recordFromTarget(target);
      });
      commit(next);
      mirror(false, Date.now());
    },
    [commit, mirror],
  );

  const restoreFromMirror = useCallback(
    (source: LocalMirror) => {
      const next = { ...recordsRef.current };
      const touched: number[] = [];
      source.records.forEach((record) => {
        if (!next[record.employeeId]) return;
        next[record.employeeId] = {
          employeeId: record.employeeId,
          familiarityCode: record.familiarityCode ?? null,
          scores: { ...(record.scores ?? {}) },
          comments: { ...(record.comments ?? {}) },
          overallComment: record.overallComment ?? null,
        };
        touched.push(record.employeeId);
      });
      commit(next);
      setRecovery(null);
      if (touched.length > 0) schedule(touched);
    },
    [commit, schedule],
  );

  const discardMirror = useCallback(() => {
    if (periodRef.current && userRef.current)
      clearMirror(periodRef.current, userRef.current);
    setRecovery(null);
  }, []);

  useEffect(() => {
    if (!task || !userId) return;
    resetFromServer(task);
  }, [task, userId, resetFromServer]);

  const probedRef = useRef('');
  useEffect(() => {
    if (!task?.period || !userId) return;
    const periodId = task.period.id;
    const probeKey = `${periodId}:${userId}`;
    if (probedRef.current === probeKey) return;
    probedRef.current = probeKey;
    const local = readMirror(periodId, userId);
    if (!local?.dirty || local.records.length === 0) return;
    if (!task.editable) {
      clearMirror(periodId, userId);
      return;
    }
    setRecovery(local);
  }, [task, userId]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current.size === 0) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer);
      });
      timers.clear();
    };
  }, []);

  return {
    records,
    saveState,
    savedAt,
    pendingCount,
    recovery,
    setFamiliarity,
    setScore,
    setComment,
    setOverallComment,
    resetFromServer,
    restoreFromMirror,
    discardMirror,
    flush,
  };
}
