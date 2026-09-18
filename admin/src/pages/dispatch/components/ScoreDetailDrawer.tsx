import type { ProDescriptionsColumn } from '@ant-design/pro-components';
import { ProDescriptions } from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Drawer,
  Progress,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';
import { clsx } from 'clsx';
import type React from 'react';
import { useMemo } from 'react';
import Trend from '@/pages/dashboard/analysis/components/Trend';
import {
  ADJUST_TYPE_LABEL,
  coverageColor,
  DISPATCH_QUERY_KEY,
  formatDelta,
  formatPercent,
  formatScore,
  gradeColor,
  ROLE_BAR_COLOR,
  ROLE_FALLBACK_LABEL,
  ROLE_ORDER,
} from '../constants';
import type { ScoreBlock, ScoreDetail } from '../data.d';
import { fetchScoreDetail } from '../service';
import { useDispatchStyles } from '../styles';

type ScoreDetailDrawerProps = {
  open: boolean;
  employeeId?: number;
  employeeName?: string;
  periodId?: number;
  periodLabel?: string;
  onClose: () => void;
};

type BlockRow = {
  roleCode: string;
  roleLabel: string;
  block: ScoreBlock | null;
};

const ScoreDetailDrawer: React.FC<ScoreDetailDrawerProps> = ({
  open,
  employeeId,
  employeeName,
  periodId,
  periodLabel,
  onClose,
}) => {
  const { styles } = useDispatchStyles();

  const detailQuery = useQuery({
    queryKey: [DISPATCH_QUERY_KEY, 'detail', employeeId, periodId],
    queryFn: async () =>
      (await fetchScoreDetail(employeeId as number, periodId)).data,
    enabled: open && Boolean(employeeId),
    staleTime: 60 * 1000,
  });

  const detail = detailQuery.data;

  const blockRows = useMemo<BlockRow[]>(() => {
    const blocks = detail?.blocks ?? [];
    const map = new Map(blocks.map((item) => [item.roleCode, item]));
    const ordered = ROLE_ORDER.map((roleCode) => {
      const block = map.get(roleCode) ?? null;
      return {
        roleCode,
        roleLabel:
          block?.roleLabel ?? ROLE_FALLBACK_LABEL[roleCode] ?? roleCode,
        block,
      };
    });
    const extra = blocks
      .filter((item) => !ROLE_ORDER.includes(item.roleCode))
      .map((item) => ({
        roleCode: item.roleCode,
        roleLabel: item.roleLabel ?? item.roleCode,
        block: item,
      }));
    return [...ordered, ...extra];
  }, [detail]);

  const coverRows = useMemo(() => {
    const list = detail?.raterSummary ?? [];
    return [...list].sort((a, b) => {
      const left = ROLE_ORDER.indexOf(a.roleCode);
      const right = ROLE_ORDER.indexOf(b.roleCode);
      return (left < 0 ? 99 : left) - (right < 0 ? 99 : right);
    });
  }, [detail]);

  const overviewColumns: ProDescriptionsColumn<ScoreDetail>[] = [
    {
      title: '最终分',
      key: 'wFinal',
      render: (_, entity) => (
        <span className={styles.scoreValue}>
          {formatScore(entity.snapshot?.wFinal)}
        </span>
      ),
    },
    {
      title: '档位',
      key: 'gradeCode',
      render: (_, entity) => (
        <Tag color={gradeColor(entity.snapshot?.gradeCode)}>
          {entity.snapshot?.gradeCode ?? '-'}
        </Tag>
      ),
    },
    {
      title: '排名',
      key: 'rankNo',
      render: (_, entity) =>
        entity.snapshot?.rankNo ? (
          <Space size={6}>
            <span>第 {entity.snapshot.rankNo} 名</span>
            {entity.snapshot.rankPct !== null &&
              entity.snapshot.rankPct !== undefined && (
                <Typography.Text type="secondary">
                  前 {formatPercent(entity.snapshot.rankPct)}
                </Typography.Text>
              )}
          </Space>
        ) : (
          <Typography.Text type="secondary">未参与排名</Typography.Text>
        ),
    },
    {
      title: '较上期变化',
      key: 'delta',
      render: (_, entity) => {
        const snapshot = entity.snapshot;
        if (
          !snapshot ||
          snapshot.wPrev === null ||
          snapshot.wPrev === undefined
        )
          return <Typography.Text type="secondary">首期无对比</Typography.Text>;
        const delta = Number((snapshot.wFinal - snapshot.wPrev).toFixed(2));
        if (delta === 0)
          return (
            <Space size={6}>
              <span>持平</span>
              <Typography.Text type="secondary">
                上期 {formatScore(snapshot.wPrev)}
              </Typography.Text>
            </Space>
          );
        return (
          <Space size={6}>
            <Trend reverseColor flag={delta > 0 ? 'up' : 'down'}>
              {formatDelta(delta)}
            </Trend>
            <Typography.Text type="secondary">
              上期 {formatScore(snapshot.wPrev)}
            </Typography.Text>
          </Space>
        );
      },
    },
    {
      title: '覆盖度',
      key: 'coverage',
      render: (_, entity) => (
        <Space size={6}>
          <Tag color={coverageColor(entity.snapshot?.coverageLevel)}>
            {entity.snapshot?.coverageLabel || '-'}
          </Tag>
          <Typography.Text type="secondary">
            {formatPercent(entity.snapshot?.coverageScore)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '有效样本量',
      key: 'effectiveN',
      render: (_, entity) => (
        <Space size={6}>
          <span>{formatScore(entity.snapshot?.effectiveN)}</span>
          <Typography.Text type="secondary">
            评价人 {entity.snapshot?.raterCount ?? 0} 位
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '分数区间',
      key: 'scoreBand',
      render: (_, entity) =>
        entity.snapshot?.scoreBand ? (
          <span>
            {formatScore(entity.snapshot.wFinal, 1)} ±
            {formatScore(entity.snapshot.scoreBand, 1)}
          </span>
        ) : (
          <Typography.Text type="secondary">区间不可估</Typography.Text>
        ),
    },
  ];

  return (
    <Drawer
      open={open}
      size={720}
      onClose={onClose}
      destroyOnHidden
      title={
        <Space size={8}>
          <span>{employeeName || detail?.employee?.name || '得分明细'}</span>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {periodLabel || ''} 得分明细
          </Typography.Text>
        </Space>
      }
    >
      {detailQuery.isError && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title="明细加载失败"
          description="可能是这名编辑本期没有评价结果，请刷新后重试。"
        />
      )}
      {detailQuery.isLoading && <Skeleton active paragraph={{ rows: 8 }} />}
      {!detailQuery.isLoading && detail && (
        <Space vertical size={20} style={{ width: '100%' }}>
          <ProDescriptions<ScoreDetail>
            column={2}
            dataSource={detail}
            columns={overviewColumns}
          />

          <div>
            <div className={styles.sectionTitle}>各维度得分</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              名义权重是配置里的分工比例，可信度按评价人熟悉度折算，实际权重是两者归一后的结果
            </Typography.Text>
            <div style={{ marginTop: 8 }}>
              {blockRows.map((row) => {
                const block = row.block;
                const missing = !block || block.wasMissing;
                const percent = Math.max(
                  Math.min(Number(block?.blockScore ?? 0), 100),
                  0,
                );
                return (
                  <div
                    key={row.roleCode}
                    className={clsx(
                      styles.blockRow,
                      missing && styles.blockMissing,
                    )}
                  >
                    <div className={styles.blockHead}>
                      <span className={styles.blockName}>{row.roleLabel}</span>
                      {missing ? (
                        <Typography.Text type="secondary">
                          本期无人评价
                        </Typography.Text>
                      ) : (
                        <span className={styles.blockScore}>
                          {formatScore(block?.blockScore)}
                        </span>
                      )}
                    </div>
                    <Progress
                      percent={missing ? 0 : percent}
                      showInfo={false}
                      strokeWidth={8}
                      strokeColor={ROLE_BAR_COLOR[row.roleCode] ?? '#1677ff'}
                    />
                    <div className={styles.blockMeta}>
                      <span>
                        名义权重 {formatPercent(block?.nominalWeight, 0)}
                      </span>
                      <span>可信度 {formatScore(block?.credibility)}</span>
                      <span>
                        实际权重 {formatPercent(block?.appliedWeight)}
                      </span>
                      <span>评价人数 {block?.raterCount ?? 0} 位</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <div className={styles.sectionTitle}>评价人覆盖情况</div>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              只展示各维度的评价人数与熟悉度合计，不展示具体评价人及其打分
            </Typography.Text>
            <div style={{ marginTop: 8 }}>
              {coverRows.length === 0 && (
                <Typography.Text type="secondary">
                  本期没有任何人提交评价
                </Typography.Text>
              )}
              {coverRows.map((row) => (
                <div key={row.roleCode} className={styles.coverRow}>
                  <span>
                    {row.roleLabel ||
                      ROLE_FALLBACK_LABEL[row.roleCode] ||
                      row.roleCode}
                  </span>
                  <span className={styles.coverMeta}>
                    {row.count} 人评价，熟悉度合计{' '}
                    {formatScore(row.familiaritySum, 1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {detail.adjustments?.length > 0 && (
            <div>
              <div className={styles.sectionTitle}>人工调整记录</div>
              <div style={{ marginTop: 4 }}>
                {detail.adjustments.map((item) => (
                  <div
                    key={`${item.adjustType}-${item.valueBefore}-${item.valueAfter}-${item.reason}`}
                    className={styles.adjustRow}
                  >
                    <Space size={8} wrap>
                      <Tag color={item.wasEffective ? 'blue' : 'default'}>
                        {ADJUST_TYPE_LABEL[item.adjustType] ?? item.adjustType}
                      </Tag>
                      {item.valueUsed !== null &&
                        item.valueUsed !== undefined && (
                          <span>调整值 {formatScore(item.valueUsed)}</span>
                        )}
                      <span>
                        {formatScore(item.valueBefore)} →{' '}
                        {formatScore(item.valueAfter)}
                      </span>
                      {!item.wasEffective && (
                        <Tag color="default" variant="filled">
                          未生效
                        </Tag>
                      )}
                    </Space>
                    <div className={styles.adjustMeta}>
                      理由 {item.reason || '未填写'}
                      {item.createdByName
                        ? `，操作人 ${item.createdByName}`
                        : ''}
                      {item.skipReason ? `，跳过原因 ${item.skipReason}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Space>
      )}
    </Drawer>
  );
};

export default ScoreDetailDrawer;
