import { CheckCircleOutlined, SaveOutlined } from '@ant-design/icons';
import { FooterToolbar, PageContainer } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useModel } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Divider,
  Modal,
  Result,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useCallback, useMemo, useRef, useState } from 'react';
import LeadGroup from './components/LeadGroup';
import SideNav from './components/SideNav';
import StatsBar from './components/StatsBar';
import SubmitConfirmModal from './components/SubmitConfirmModal';
import TargetCard from './components/TargetCard';
import { SCORING_TASK_QUERY_KEY } from './constants';
import type {
  DraftRecord,
  FieldError,
  LocalStatus,
  ScoringTarget,
} from './data.d';
import {
  computeLocalStatus,
  groupByLead,
  hasAnyInput,
  isUnknownSelected,
  normalizeErrorCode,
  unknownOption,
  validateRecord,
} from './helpers';
import {
  fetchScoringTask,
  markUnknown,
  readBizError,
  submitScoring,
} from './service';
import { useScoringStyles } from './styles';
import { useScoringDraft } from './useScoringDraft';

const ScoringTask = () => {
  const { styles } = useScoringStyles();
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const userId = currentUser?.userid ?? '';

  const taskQuery = useQuery({
    queryKey: [SCORING_TASK_QUERY_KEY, userId],
    queryFn: () => fetchScoringTask(),
    enabled: Boolean(userId),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const task = taskQuery.data;
  const draft = useScoringDraft({ task, userId });

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [flashId, setFlashId] = useState<number | null>(null);
  const [errorMap, setErrorMap] = useState<Record<number, string[]>>({});
  const cardRefs = useRef(new Map<number, HTMLDivElement>());
  const flashTimer = useRef<number | null>(null);

  const targets = useMemo(() => task?.targets ?? [], [task]);
  const items = useMemo(() => task?.items ?? [], [task]);
  const familiarityOptions = useMemo(
    () => task?.familiarityOptions ?? [],
    [task],
  );
  const period = task?.period ?? null;
  const periodClosed = Boolean(period && period.status !== 'open');
  const readonly = Boolean(task && (!task.editable || periodClosed));

  const statusMap = useMemo(() => {
    const map = new Map<number, LocalStatus>();
    targets.forEach((target) => {
      map.set(
        target.employeeId,
        computeLocalStatus(
          target,
          draft.records[target.employeeId],
          items,
          familiarityOptions,
        ),
      );
    });
    return map;
  }, [targets, draft.records, items, familiarityOptions]);

  const statusOf = useCallback(
    (employeeId: number) => statusMap.get(employeeId) ?? 'empty',
    [statusMap],
  );

  const counters = useMemo(() => {
    let done = 0;
    let skipped = 0;
    let empty = 0;
    let partial = 0;
    let submitted = 0;
    statusMap.forEach((status) => {
      if (status === 'done') done += 1;
      else if (status === 'skipped') skipped += 1;
      else if (status === 'empty') empty += 1;
      else if (status === 'partial') partial += 1;
      else submitted += 1;
    });
    return { done, skipped, empty, partial, submitted };
  }, [statusMap]);

  const groups = useMemo(() => groupByLead(targets), [targets]);

  const scrollTo = useCallback((employeeId: number) => {
    const node = cardRefs.current.get(employeeId);
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const highlight = useCallback(
    (employeeId: number) => {
      scrollTo(employeeId);
      setFlashId(employeeId);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlashId(null), 3000);
    },
    [scrollTo],
  );

  const applyFieldErrors = useCallback(
    (errors: FieldError[]) => {
      const next: Record<number, string[]> = {};
      errors.forEach((error) => {
        const bucket = next[error.employeeId] ?? [];
        bucket.push(normalizeErrorCode(error.itemCode));
        next[error.employeeId] = bucket;
      });
      setErrorMap(next);
      if (errors.length > 0) highlight(errors[0].employeeId);
    },
    [highlight],
  );

  const buildRecord = useCallback(
    (target: ScoringTarget): DraftRecord => {
      const record = draft.records[target.employeeId];
      return {
        employeeId: target.employeeId,
        familiarityCode: record?.familiarityCode ?? null,
        scores: record?.scores ?? {},
        comments: record?.comments ?? {},
        overallComment: record?.overallComment ?? null,
      };
    },
    [draft.records],
  );

  const unknownCode = unknownOption(familiarityOptions)?.code ?? 'UNKNOWN';

  const unknownMutation = useMutation({
    mutationFn: async (employeeIds: number[]) => {
      if (!period) throw new Error('周期未就绪');
      await draft.flush();
      return markUnknown({ periodId: period.id, employeeIds });
    },
    onSuccess: (result) => {
      message.success(`已把 ${result.count} 人标记为不了解`);
      queryClient.invalidateQueries({ queryKey: [SCORING_TASK_QUERY_KEY] });
    },
    onError: (error) => {
      message.error(readBizError(error).errorMessage || '标记失败，请重试');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (records: DraftRecord[]) => {
      if (!period) throw new Error('周期未就绪');
      await draft.flush();
      return submitScoring({ periodId: period.id, records });
    },
    onSuccess: (result) => {
      setConfirmOpen(false);
      setErrorMap({});
      draft.discardMirror();
      message.success(
        `提交成功，已评 ${result.submittedCount} 人，跳过 ${result.unknownCount} 人`,
      );
      queryClient.invalidateQueries({ queryKey: [SCORING_TASK_QUERY_KEY] });
    },
    onError: (error) => {
      const info = readBizError(error);
      const fieldErrors = info.data?.fieldErrors ?? [];
      if (fieldErrors.length > 0) {
        setConfirmOpen(false);
        applyFieldErrors(fieldErrors);
        message.error(fieldErrors[0].message);
        return;
      }
      message.error(info.errorMessage || '提交失败，请稍后重试');
    },
  });

  const markGroupUnknown = (leadName: string, rows: ScoringTarget[]) => {
    const pending = rows.filter((row) => {
      const status = statusOf(row.employeeId);
      return status !== 'submitted' && status !== 'skipped';
    });
    if (pending.length === 0) return;
    const filled = pending.filter((row) =>
      hasAnyInput(draft.records[row.employeeId]),
    );
    modal.confirm({
      title: `把${leadName}带的 ${pending.length} 人整组标记为不了解`,
      width: 480,
      okText: '确认标记',
      cancelText: '再想想',
      content: (
        <Space direction="vertical" size={8}>
          <span>
            这 {pending.length}{' '}
            人本期不计入你这一票，你只需要认真填剩下的人。标记后还能单个改回来。
          </span>
          {filled.length > 0 ? (
            <Typography.Text type="danger">
              其中 {filled.map((row) => row.name).join('、')}{' '}
              已经填过一部分，标记后这部分内容会被清空。
            </Typography.Text>
          ) : null}
        </Space>
      ),
      onOk: () =>
        unknownMutation
          .mutateAsync(pending.map((row) => row.employeeId))
          .catch(() => undefined),
    });
  };

  const restoreGroup = (rows: ScoringTarget[]) => {
    rows.forEach((row) => {
      if (statusOf(row.employeeId) !== 'skipped') return;
      draft.setFamiliarity(row.employeeId, null, false);
    });
  };

  const openConfirm = () => {
    const broken = targets.filter(
      (target) => statusOf(target.employeeId) === 'partial',
    );
    if (broken.length > 0) {
      const errors: FieldError[] = [];
      broken.forEach((target) => {
        errors.push(
          ...validateRecord(
            target,
            draft.records[target.employeeId],
            items,
            familiarityOptions,
          ),
        );
      });
      applyFieldErrors(errors);
      message.error(
        `${broken.length} 人还没填完：${errors[0]?.name ?? ''} ${errors[0]?.message ?? ''}`,
      );
      return;
    }
    setErrorMap({});
    setConfirmOpen(true);
  };

  const confirmSubmit = (markRestUnknown: boolean) => {
    const records: DraftRecord[] = [];
    targets.forEach((target) => {
      const status = statusOf(target.employeeId);
      if (status === 'submitted') return;
      if (status === 'done' || status === 'skipped') {
        records.push(buildRecord(target));
        return;
      }
      if (markRestUnknown && status === 'empty') {
        records.push({
          employeeId: target.employeeId,
          familiarityCode: unknownCode,
          scores: {},
          comments: {},
          overallComment: null,
        });
      }
    });
    if (records.length === 0) {
      message.warning('没有可提交的内容');
      return;
    }
    submitMutation.mutate(records);
  };

  const unfilled = useMemo(
    () =>
      targets
        .filter((target) => statusOf(target.employeeId) === 'empty')
        .map((target) => ({
          employeeId: target.employeeId,
          name: target.name,
        })),
    [targets, statusOf],
  );

  const renderGuard = () => {
    if (!task) return null;
    if (!period)
      return (
        <Result
          status="info"
          title="还没有可打分的评价周期"
          subTitle="管理员建好本期评价并开启后，这里会自动出现你要评的人。"
        />
      );
    if (period.status === 'draft')
      return (
        <Result
          status="info"
          title={`${period.code} 周期还没开启`}
          subTitle="管理员开启本期评价后，这里会自动出现你要评的人。"
        />
      );
    if (targets.length === 0)
      return (
        <Result
          status="success"
          title="本期没有需要你评价的人"
          subTitle="如果这不符合预期，请联系管理员检查评价关系配置。"
        />
      );
    return null;
  };

  if (taskQuery.isPending)
    return (
      <PageContainer title="本期打分">
        <Skeleton active paragraph={{ rows: 8 }} />
      </PageContainer>
    );

  if (taskQuery.isError)
    return (
      <PageContainer title="本期打分">
        <Result
          status="error"
          title="打分任务加载失败"
          subTitle={
            readBizError(taskQuery.error).errorMessage ||
            '请确认后端服务已启动，然后重试。'
          }
          extra={
            <Button type="primary" onClick={() => taskQuery.refetch()}>
              重新加载
            </Button>
          }
        />
      </PageContainer>
    );

  const guard = renderGuard();

  return (
    <PageContainer
      title="本期打分"
      content={
        task && period ? (
          <Space size={8} wrap>
            <Tag color="blue">{period.code}</Tag>
            <Tag>{task.roleLabel}</Tag>
            <Typography.Text type="secondary">
              你以{task.roleLabel}的身份评价 {targets.length} 名编辑，每人{' '}
              {items.length} 个题项，1 到 5 分。
            </Typography.Text>
          </Space>
        ) : undefined
      }
    >
      {periodClosed && period ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={`${period.code} 周期已${period.statusLabel || '截止'}，本页只读`}
          description="截止后不能再改分，如需更正请联系管理员。"
        />
      ) : null}

      {guard}

      {!guard && task ? (
        <>
          <StatsBar
            total={targets.length}
            doneCount={counters.done + counters.submitted}
            skippedCount={counters.skipped}
            emptyCount={counters.empty}
            partialCount={counters.partial}
            closeAt={period?.closeAt}
            saveState={draft.saveState}
            savedAt={draft.savedAt}
            pendingCount={draft.pendingCount}
            readonly={readonly}
            onManualSave={() => void draft.flush()}
          />

          {readonly ? (
            <Alert
              type="success"
              showIcon
              icon={<CheckCircleOutlined />}
              style={{ marginBottom: 12 }}
              title={`本期评价已提交，共 ${counters.submitted} 人已评、${counters.skipped} 人跳过`}
              description="提交后不可修改，如需更正请联系管理员。下面保留你提交的内容，可随时回看。"
            />
          ) : null}

          <div className={styles.shell}>
            <div className={styles.mainColumn}>
              {groups.map((group) => {
                const markable = group.rows.filter((row) => {
                  const status = statusOf(row.employeeId);
                  return status !== 'submitted' && status !== 'skipped';
                }).length;
                const restorable = group.rows.filter(
                  (row) => statusOf(row.employeeId) === 'skipped',
                ).length;
                const groupDone = group.rows.filter((row) => {
                  const status = statusOf(row.employeeId);
                  return status === 'done' || status === 'submitted';
                }).length;
                return (
                  <LeadGroup
                    key={group.key}
                    leadName={group.leadName}
                    total={group.rows.length}
                    doneCount={groupDone}
                    skippedCount={restorable}
                    markableCount={markable}
                    restorableCount={restorable}
                    readonly={readonly}
                    loading={unknownMutation.isPending}
                    onMarkUnknown={() =>
                      markGroupUnknown(group.leadName, group.rows)
                    }
                    onRestore={() => restoreGroup(group.rows)}
                  >
                    {group.rows.map((target) => (
                      <TargetCard
                        key={target.employeeId}
                        target={target}
                        record={draft.records[target.employeeId]}
                        items={items}
                        familiarityOptions={familiarityOptions}
                        status={statusOf(target.employeeId)}
                        readonly={readonly}
                        flash={flashId === target.employeeId}
                        errorCodes={errorMap[target.employeeId] ?? []}
                        registerRef={(node) => {
                          if (node)
                            cardRefs.current.set(target.employeeId, node);
                          else cardRefs.current.delete(target.employeeId);
                        }}
                        onFamiliarity={(code) =>
                          draft.setFamiliarity(
                            target.employeeId,
                            code,
                            isUnknownSelected(familiarityOptions, code),
                          )
                        }
                        onScore={(itemCode, score) => {
                          const item = items.find(
                            (entry) => entry.code === itemCode,
                          );
                          draft.setScore(
                            target.employeeId,
                            itemCode,
                            score,
                            item?.commentRequiredBelow ?? 3,
                          );
                        }}
                        onComment={(itemCode, text) =>
                          draft.setComment(target.employeeId, itemCode, text)
                        }
                        onOverallComment={(text) =>
                          draft.setOverallComment(target.employeeId, text)
                        }
                      />
                    ))}
                  </LeadGroup>
                );
              })}
            </div>

            <div className={styles.navColumn}>
              <SideNav
                targets={targets}
                statusOf={statusOf}
                onJump={scrollTo}
              />
            </div>
          </div>
        </>
      ) : null}

      {!guard && task && !readonly ? (
        <FooterToolbar
          extra={
            <Space split={<Divider type="vertical" />} wrap>
              <span>
                已评{' '}
                <Typography.Text strong style={{ color: '#389e0d' }}>
                  {counters.done}
                </Typography.Text>{' '}
                人
              </span>
              <span>跳过 {counters.skipped} 人</span>
              <span
                style={{
                  color: counters.partial > 0 ? '#d46b08' : undefined,
                }}
              >
                填写中 {counters.partial} 人
              </span>
              <span>未开始 {counters.empty} 人</span>
            </Space>
          }
        >
          <Button
            icon={<SaveOutlined />}
            disabled={draft.pendingCount === 0}
            onClick={() => void draft.flush()}
          >
            立即保存草稿
          </Button>
          <Button
            type="primary"
            loading={submitMutation.isPending}
            onClick={openConfirm}
          >
            提交本期评价
          </Button>
        </FooterToolbar>
      ) : null}

      <SubmitConfirmModal
        open={confirmOpen}
        loading={submitMutation.isPending}
        doneCount={counters.done}
        skippedCount={counters.skipped}
        unfilled={unfilled}
        onCancel={() => setConfirmOpen(false)}
        onJump={(employeeId) => {
          setConfirmOpen(false);
          highlight(employeeId);
        }}
        onConfirm={confirmSubmit}
      />

      <Modal
        open={Boolean(draft.recovery)}
        title="本机还有一份没同步上去的草稿"
        okText="恢复本机草稿"
        cancelText="用服务端的版本"
        onOk={() => {
          if (draft.recovery) draft.restoreFromMirror(draft.recovery);
        }}
        onCancel={draft.discardMirror}
        destroyOnHidden
      >
        <Space direction="vertical" size={8}>
          <span>
            上次在这台电脑上填写的内容（
            {draft.recovery
              ? new Date(draft.recovery.savedAt).toLocaleString('zh-CN')
              : ''}
            ）没能保存到服务器，可能是当时网络中断或页面被关掉。
          </span>
          <Typography.Text type="secondary">
            选择恢复会用本机内容覆盖当前页面并重新保存；选择服务端版本则丢弃本机这份。
          </Typography.Text>
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default ScoringTask;
