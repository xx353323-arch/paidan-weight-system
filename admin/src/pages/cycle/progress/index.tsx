import { ReloadOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import {
  PageContainer,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { history, Link, useParams } from '@umijs/max';
import { Alert, Button, Progress, Space, Tag, Typography } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import {
  bizMessage,
  formatPeriodTitle,
  PERIOD_STATUS_TAG_COLOR,
  RATER_STATE_META,
  ROLE_COLOR,
  ROLE_LABEL,
  toPercent,
} from '../constants';
import type { ProgressRaterItem } from './data.d';
import { fetchPeriodProgress } from './service';

const EMPTY_SUMMARY = {
  taskTotal: 0,
  taskDone: 0,
  rate: 0,
  raterTotal: 0,
  raterFinished: 0,
};

const CycleProgress: React.FC = () => {
  const { periodId } = useParams<{ periodId: string }>();
  const id = Number(periodId);
  const validId = Number.isFinite(id) && id > 0;

  const progressQuery = useQuery({
    queryKey: ['cycle', 'progress', id],
    queryFn: async () => (await fetchPeriodProgress(id)).data,
    enabled: validId,
  });

  const items = useMemo(
    () => progressQuery.data?.items ?? [],
    [progressQuery.data],
  );
  const summary = progressQuery.data?.summary ?? EMPTY_SUMMARY;
  const period = progressQuery.data?.period;
  const percent = toPercent(summary.rate);

  const columns: ProColumns<ProgressRaterItem>[] = [
    {
      title: '评价人',
      dataIndex: 'raterName',
      width: 120,
      render: (_, record) => (
        <Typography.Text strong>{record.raterName}</Typography.Text>
      ),
    },
    {
      title: '角色',
      dataIndex: 'roleCode',
      width: 110,
      render: (_, record) => (
        <Tag color={ROLE_COLOR[record.roleCode] ?? 'default'}>
          {ROLE_LABEL[record.roleCode] ?? record.roleCode}
        </Tag>
      ),
    },
    { title: '应评人数', dataIndex: 'total', width: 100, align: 'right' },
    { title: '已提交', dataIndex: 'submitted', width: 90, align: 'right' },
    {
      title: '已跳过',
      dataIndex: 'unknown',
      width: 90,
      align: 'right',
      tooltip: '评价人选择不了解，这条记录不参与计分',
    },
    { title: '草稿中', dataIndex: 'draft', width: 90, align: 'right' },
    {
      title: '未开始',
      dataIndex: 'pending',
      width: 90,
      align: 'right',
      render: (_, record) =>
        record.pending > 0 ? (
          <Typography.Text type="warning">{record.pending}</Typography.Text>
        ) : (
          0
        ),
    },
    {
      title: '完成率',
      dataIndex: 'rate',
      width: 170,
      render: (_, record) => (
        <Progress
          percent={toPercent(record.rate)}
          size="small"
          status={record.state === 'finished' ? 'success' : 'active'}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'state',
      width: 100,
      render: (_, record) => {
        const meta = RATER_STATE_META[record.state] ?? {
          label: record.state,
          color: 'default',
        };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '最后保存',
      dataIndex: 'lastSavedAt',
      width: 170,
      render: (_, record) =>
        record.lastSavedAt ? (
          record.lastSavedAt.replace('T', ' ').slice(0, 19)
        ) : (
          <span style={{ color: '#bfbfbf' }}>未保存</span>
        ),
    },
  ];

  return (
    <PageContainer
      title={period ? `${formatPeriodTitle(period.code)} 提交进度` : '周期进度'}
      tags={
        period ? (
          <Tag color={PERIOD_STATUS_TAG_COLOR[period.status] ?? 'default'}>
            {period.statusLabel}
          </Tag>
        ) : undefined
      }
      content="按评价人统计本周期的填报情况，完成率低的排在前面，便于催办。"
      onBack={() => history.push('/cycle/list')}
      extra={[
        <Link key="back" to="/cycle/list">
          <Button>返回周期列表</Button>
        </Link>,
        <Button
          key="refresh"
          type="primary"
          icon={<ReloadOutlined />}
          loading={progressQuery.isFetching}
          onClick={() => progressQuery.refetch()}
        >
          刷新
        </Button>,
      ]}
    >
      <Space vertical size={16} style={{ width: '100%' }}>
        {!validId && (
          <Alert
            type="error"
            showIcon
            title="周期编号无效"
            description="请从周期列表点击查看进度进入本页。"
          />
        )}
        {progressQuery.isError && (
          <Alert
            type="error"
            showIcon
            title="进度加载失败"
            description={bizMessage(progressQuery.error, '请稍后重试')}
          />
        )}
        <StatisticCard.Group direction="row" loading={progressQuery.isLoading}>
          <StatisticCard
            statistic={{
              title: '任务总数',
              value: summary.taskTotal,
              suffix: '条',
            }}
          />
          <StatisticCard.Divider />
          <StatisticCard
            statistic={{
              title: '已完成',
              value: summary.taskDone,
              suffix: '条',
              status: 'success',
              description: (
                <StatisticCard.Statistic
                  title="未完成"
                  value={Math.max(summary.taskTotal - summary.taskDone, 0)}
                  suffix="条"
                />
              ),
            }}
          />
          <StatisticCard.Divider />
          <StatisticCard
            statistic={{ title: '整体完成率', value: percent, suffix: '%' }}
            chart={
              <Progress
                percent={percent}
                showInfo={false}
                status={percent >= 100 ? 'success' : 'active'}
              />
            }
            chartPlacement="bottom"
          />
          <StatisticCard.Divider />
          <StatisticCard
            statistic={{
              title: '已完成的评价人',
              value: summary.raterFinished,
              suffix: `/ ${summary.raterTotal} 人`,
            }}
          />
        </StatisticCard.Group>
        <ProTable<ProgressRaterItem>
          headerTitle="评价人填报进度"
          rowKey={(record) => `${record.raterUserId}-${record.roleCode}`}
          search={false}
          options={false}
          pagination={false}
          scroll={{ x: 1150 }}
          loading={progressQuery.isFetching}
          dataSource={items}
          columns={columns}
        />
      </Space>
    </PageContainer>
  );
};

export default CycleProgress;
