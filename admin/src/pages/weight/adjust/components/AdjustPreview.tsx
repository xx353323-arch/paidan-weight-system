import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Card,
  Collapse,
  Skeleton,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type React from 'react';
import { useEffect, useState } from 'react';
import {
  ADJUST_QUERY_KEY,
  bizMessage,
  formatGrade,
  formatRank,
  formatScore,
  GRADE_COLOR,
} from '../constants';
import type { AdjustType, GradeDistItem, RankChange } from '../data.d';
import { previewAdjustment } from '../service';

type AdjustPreviewProps = {
  employeeId?: number;
  adjustType?: AdjustType;
  value?: number;
  periodId?: number;
};

type PreviewKey = {
  employeeId?: number;
  adjustType?: AdjustType;
  value?: number;
  periodId?: number;
};

const isReady = (key: PreviewKey) => {
  if (!key.employeeId || !key.adjustType || !key.periodId) return false;
  if (key.adjustType === 'FREEZE') return true;
  return typeof key.value === 'number' && !Number.isNaN(key.value);
};

const DeltaText: React.FC<{ delta: number; suffix: string }> = ({
  delta,
  suffix,
}) => {
  if (Math.abs(delta) < 0.005) {
    return <Typography.Text type="secondary">持平</Typography.Text>;
  }
  const up = delta > 0;
  return (
    <Typography.Text style={{ color: up ? '#389e0d' : '#cf1322' }}>
      {up ? '↑' : '↓'}
      {Math.abs(delta).toFixed(suffix === '分' ? 2 : 0)}
      {suffix}
    </Typography.Text>
  );
};

const CompareBlock: React.FC<{
  label: string;
  before: React.ReactNode;
  after: React.ReactNode;
  delta?: React.ReactNode;
}> = ({ label, before, after, delta }) => (
  <div
    style={{
      flex: 1,
      minWidth: 180,
      padding: '12px 16px',
      background: 'rgba(0,0,0,0.02)',
      borderRadius: 8,
    }}
  >
    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
      {label}
    </Typography.Text>
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        marginTop: 6,
        flexWrap: 'wrap',
      }}
    >
      <Typography.Text type="secondary" style={{ fontSize: 16 }}>
        {before}
      </Typography.Text>
      <Typography.Text type="secondary">→</Typography.Text>
      <Typography.Text strong style={{ fontSize: 18 }}>
        {after}
      </Typography.Text>
      {delta}
    </div>
  </div>
);

const changeColumns = [
  {
    title: '员工',
    dataIndex: 'name',
    width: 110,
    render: (_: unknown, record: RankChange) => (
      <Space size={4}>
        <span>{record.name}</span>
        {record.isTarget && <Tag color="processing">本次调整</Tag>}
      </Space>
    ),
  },
  {
    title: '排名',
    dataIndex: 'rankAfter',
    width: 150,
    render: (_: unknown, record: RankChange) => (
      <Space size={4}>
        <Typography.Text type="secondary">
          {formatRank(record.rankBefore)}
        </Typography.Text>
        <span>→</span>
        <Typography.Text strong>{formatRank(record.rankAfter)}</Typography.Text>
      </Space>
    ),
  },
  {
    title: '权重分',
    dataIndex: 'scoreAfter',
    width: 150,
    render: (_: unknown, record: RankChange) => (
      <Space size={4}>
        <Typography.Text type="secondary">
          {formatScore(record.scoreBefore)}
        </Typography.Text>
        <span>→</span>
        <Typography.Text strong>
          {formatScore(record.scoreAfter)}
        </Typography.Text>
      </Space>
    ),
  },
  {
    title: '档位',
    dataIndex: 'gradeAfter',
    width: 110,
    render: (_: unknown, record: RankChange) =>
      record.gradeBefore === record.gradeAfter ? (
        <Tag color={GRADE_COLOR[record.gradeAfter ?? ''] ?? 'default'}>
          {formatGrade(record.gradeAfter)}
        </Tag>
      ) : (
        <Space size={4}>
          <Tag color={GRADE_COLOR[record.gradeBefore ?? ''] ?? 'default'}>
            {formatGrade(record.gradeBefore)}
          </Tag>
          <span>→</span>
          <Tag color={GRADE_COLOR[record.gradeAfter ?? ''] ?? 'default'}>
            {formatGrade(record.gradeAfter)}
          </Tag>
        </Space>
      ),
  },
];

const gradeColumns = [
  { title: '档位', dataIndex: 'label', width: 110 },
  { title: '调整前', dataIndex: 'before', width: 100 },
  { title: '调整后', dataIndex: 'after', width: 100 },
  {
    title: '变化',
    dataIndex: 'delta',
    render: (_: unknown, record: { delta: number }) =>
      record.delta === 0 ? (
        <Typography.Text type="secondary">持平</Typography.Text>
      ) : (
        <Typography.Text
          style={{ color: record.delta > 0 ? '#389e0d' : '#cf1322' }}
        >
          {record.delta > 0 ? `+${record.delta}` : record.delta} 人
        </Typography.Text>
      ),
  },
];

const mergeDistribution = (before: GradeDistItem[], after: GradeDistItem[]) => {
  const afterMap = new Map(after.map((item) => [item.code, item]));
  const codes = [
    ...before.map((item) => item.code),
    ...after.map((item) => item.code),
  ].filter((code, index, list) => list.indexOf(code) === index);
  return codes.map((code) => {
    const beforeItem = before.find((item) => item.code === code);
    const afterItem = afterMap.get(code);
    const beforeCount = beforeItem?.count ?? 0;
    const afterCount = afterItem?.count ?? 0;
    return {
      code,
      label: beforeItem?.label ?? afterItem?.label ?? code,
      before: beforeCount,
      after: afterCount,
      delta: afterCount - beforeCount,
    };
  });
};

const AdjustPreview: React.FC<AdjustPreviewProps> = ({
  employeeId,
  adjustType,
  value,
  periodId,
}) => {
  const [debounced, setDebounced] = useState<PreviewKey>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced({ employeeId, adjustType, value, periodId });
    }, 400);
    return () => clearTimeout(timer);
  }, [employeeId, adjustType, value, periodId]);

  const ready = isReady(debounced);
  const typing = isReady({ employeeId, adjustType, value, periodId }) && !ready;

  const { data, error, isFetching } = useQuery({
    queryKey: [
      ADJUST_QUERY_KEY,
      'preview',
      debounced.periodId,
      debounced.employeeId,
      debounced.adjustType,
      debounced.value ?? null,
    ],
    enabled: ready,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await previewAdjustment({
        periodId: debounced.periodId as number,
        adjustments: [
          {
            employeeId: debounced.employeeId as number,
            adjustType: debounced.adjustType as AdjustType,
            value: debounced.adjustType === 'FREEZE' ? null : debounced.value,
          },
        ],
      });
      return res?.data;
    },
  });

  const target = data?.after?.find(
    (item) => item.employeeId === debounced.employeeId,
  );
  const origin = data?.before?.find(
    (item) => item.employeeId === debounced.employeeId,
  );
  const others = (data?.rankChanges ?? []).filter((item) => !item.isTarget);
  const distribution = mergeDistribution(
    data?.gradeDistributionBefore ?? [],
    data?.gradeDistributionAfter ?? [],
  );

  const renderBody = () => {
    if (!ready && !typing) {
      return (
        <Typography.Text type="secondary">
          选好员工、调整类型与调整值之后，这里会自动算出调整前后的权重分、排名与档位对比，以及被挤动排名的其他人。
        </Typography.Text>
      );
    }
    if (isFetching || typing || (!data && !error)) {
      return <Skeleton active paragraph={{ rows: 3 }} title={false} />;
    }
    if (error) {
      return (
        <Alert
          type="error"
          showIcon
          title={bizMessage(error, '预览失败，请稍后重试')}
          description="预览需要该周期已开启并绑定算法配置，草稿或已归档的周期无法试算。"
        />
      );
    }
    if (!target || !origin) {
      return (
        <Alert
          type="warning"
          showIcon
          title="该员工本期没有参与计算，无法预览"
          description="只有在职且本期有评价数据的编辑才会进入跑批结果。"
        />
      );
    }

    const rankDelta =
      origin.rankNo && target.rankNo ? origin.rankNo - target.rankNo : 0;

    return (
      <Space vertical size={16} style={{ width: '100%' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <CompareBlock
            label="权重分"
            before={formatScore(origin.wFinal)}
            after={formatScore(target.wFinal)}
            delta={
              <DeltaText delta={target.wFinal - origin.wFinal} suffix="分" />
            }
          />
          <CompareBlock
            label="排名"
            before={formatRank(origin.rankNo)}
            after={formatRank(target.rankNo)}
            delta={
              target.rankNo ? (
                <DeltaText delta={rankDelta} suffix="位" />
              ) : (
                <Typography.Text type="danger">退出派单池</Typography.Text>
              )
            }
          />
          <CompareBlock
            label="档位"
            before={formatGrade(origin.gradeCode)}
            after={
              <Tag color={GRADE_COLOR[target.gradeCode ?? ''] ?? 'default'}>
                {formatGrade(target.gradeCode)}
              </Tag>
            }
          />
        </div>
        <Collapse
          ghost
          size="small"
          items={[
            {
              key: 'others',
              label: `受影响的其他员工（${others.length} 人）`,
              children: others.length ? (
                <Table<RankChange>
                  rowKey="employeeId"
                  size="small"
                  pagination={false}
                  scroll={{ y: 220 }}
                  columns={changeColumns}
                  dataSource={others}
                />
              ) : (
                <Typography.Text type="secondary">
                  本次调整不会挤动其他人的排名。
                </Typography.Text>
              ),
            },
            {
              key: 'grade',
              label: '档位分布变化',
              children: (
                <Table
                  rowKey="code"
                  size="small"
                  pagination={false}
                  columns={gradeColumns}
                  dataSource={distribution}
                />
              ),
            },
          ]}
        />
      </Space>
    );
  };

  return (
    <Card
      variant="borderless"
      size="small"
      title="调整前后对比"
      extra={
        data?.periodCode ? (
          <Typography.Text type="secondary">
            试算周期 {data.periodCode}
          </Typography.Text>
        ) : null
      }
      styles={{ body: { paddingTop: 12 } }}
    >
      {renderBody()}
    </Card>
  );
};

export default AdjustPreview;
