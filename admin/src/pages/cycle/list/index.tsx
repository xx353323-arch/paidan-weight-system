import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Link } from '@umijs/max';
import { Alert, App, Button, Progress, Space, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useRef, useState } from 'react';
import {
  bizMessage,
  formatPeriodTitle,
  PERIOD_STATUS_VALUE_ENUM,
  parseRaterKey,
  toPercent,
} from '../constants';
import PeriodModalForm from './components/PeriodModalForm';
import type {
  MaterializeResult,
  PeriodItem,
  PeriodQueryParams,
  PeriodStatus,
} from './data.d';
import {
  closePeriod,
  openPeriod,
  queryPeriods,
  reopenPeriod,
  syncPeriodTasks,
} from './service';

type CycleActionKey =
  | 'edit'
  | 'open'
  | 'progress'
  | 'sync'
  | 'close'
  | 'reopen'
  | 'compute'
  | 'publish';

const CYCLE_ACTIONS: Record<PeriodStatus, CycleActionKey[]> = {
  draft: ['edit', 'open'],
  open: ['progress', 'sync', 'close'],
  closed: ['progress', 'reopen', 'compute'],
  computed: ['progress', 'publish'],
  published: ['progress'],
  archived: ['progress'],
};

const CycleList: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const { message, modal } = App.useApp();
  const [actingKey, setActingKey] = useState('');

  const reload = () => {
    actionRef.current?.reload();
  };

  const isActing = (record: PeriodItem, action: CycleActionKey) =>
    actingKey === `${record.id}-${action}`;

  const showMaterializeResult = (title: string, data: MaterializeResult) => {
    const entries = Object.entries(data.perRater ?? {});
    const uncovered = data.uncoveredEmployees ?? [];
    modal.success({
      title,
      width: 560,
      okText: '好的',
      content: (
        <Space vertical size={12} style={{ width: '100%' }}>
          <Typography.Text>
            本次生成待评任务{' '}
            <Typography.Text strong>{data.taskCount}</Typography.Text> 条，
            覆盖在职编辑 {data.employeeCount} 人、评价人 {data.raterCount} 个。
          </Typography.Text>
          {entries.length > 0 && (
            <div>
              <Typography.Text type="secondary">按评价人拆分</Typography.Text>
              <ul style={{ paddingInlineStart: 20, margin: '4px 0 0' }}>
                {entries.map(([key, count]) => {
                  const rater = parseRaterKey(key);
                  return (
                    <li key={key}>
                      {rater.name}（{rater.roleLabel}）{count} 条
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {entries.length === 0 && data.taskCount === 0 && (
            <Typography.Text type="secondary">
              没有新增任务，当前任务与评价关系一致。
            </Typography.Text>
          )}
          {uncovered.length > 0 && (
            <Alert
              type="warning"
              showIcon
              title={`${uncovered.length} 名编辑没有直属主管`}
              description={`${uncovered
                .map((item) => item.name)
                .join(
                  '、',
                )}。这些编辑本期拿不到编辑主管评分，请到基础数据的员工档案补齐主管，再回来补齐任务。`}
            />
          )}
        </Space>
      ),
    });
  };

  const handleOpen = (record: PeriodItem) => {
    modal.confirm({
      title: `确认开启 ${formatPeriodTitle(record.code)} 周期`,
      content:
        '开启后按当前评价关系物化待评任务，评价人即可开始打分。同一时间只允许一个周期进行中。',
      okText: '确认开启',
      cancelText: '取消',
      onOk: async () => {
        setActingKey(`${record.id}-open`);
        try {
          const res = await openPeriod(record.id);
          reload();
          showMaterializeResult('周期已开启', res.data);
        } catch (error) {
          message.error(bizMessage(error, '开启周期失败，请稍后重试'));
        } finally {
          setActingKey('');
        }
      },
    });
  };

  const handleSync = async (record: PeriodItem) => {
    setActingKey(`${record.id}-sync`);
    try {
      const res = await syncPeriodTasks(record.id);
      reload();
      if (res.data.taskCount === 0 && !res.data.uncoveredEmployees?.length) {
        message.success('任务已是最新，无需补齐');
      } else {
        showMaterializeResult('任务补齐完成', res.data);
      }
    } catch (error) {
      message.error(bizMessage(error, '补齐任务失败，请稍后重试'));
    } finally {
      setActingKey('');
    }
  };

  const handleClose = (record: PeriodItem) => {
    const remain = Math.max(
      (record.taskTotal ?? 0) - (record.taskDone ?? 0),
      0,
    );
    modal.confirm({
      title: `确认截止 ${formatPeriodTitle(record.code)} 周期`,
      content: `截止后评价人无法继续填写，将有 ${remain} 条未提交任务失效。如需补填可在已截止状态下重新开启。`,
      okText: '确认截止',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        setActingKey(`${record.id}-close`);
        try {
          const res = await closePeriod(record.id);
          reload();
          message.success(
            `周期已截止，${res.data.expiredCount} 条未提交任务标记为失效`,
          );
        } catch (error) {
          message.error(bizMessage(error, '截止周期失败，请稍后重试'));
        } finally {
          setActingKey('');
        }
      },
    });
  };

  const handleReopen = (record: PeriodItem) => {
    modal.confirm({
      title: `确认重新开启 ${formatPeriodTitle(record.code)} 周期`,
      content: '失效的任务会恢复成待填写或草稿状态，评价人可以继续提交。',
      okText: '确认开启',
      cancelText: '取消',
      onOk: async () => {
        setActingKey(`${record.id}-reopen`);
        try {
          const res = await reopenPeriod(record.id);
          reload();
          message.success(
            `周期已重新开启，恢复 ${res.data.restoredCount} 条任务`,
          );
        } catch (error) {
          message.error(bizMessage(error, '重新开启失败，请稍后重试'));
        } finally {
          setActingKey('');
        }
      },
    });
  };

  const ACTION_RENDER: Record<
    CycleActionKey,
    (record: PeriodItem) => React.ReactNode
  > = {
    edit: (record) => (
      <PeriodModalForm
        key="edit"
        values={record}
        onSuccess={reload}
        trigger={
          <Button type="link" size="small">
            编辑
          </Button>
        }
      />
    ),
    open: (record) => (
      <Button
        key="open"
        type="link"
        size="small"
        loading={isActing(record, 'open')}
        onClick={() => handleOpen(record)}
      >
        开启
      </Button>
    ),
    progress: (record) => (
      <Link key="progress" to={`/cycle/progress/${record.id}`}>
        <Button type="link" size="small">
          查看进度
        </Button>
      </Link>
    ),
    sync: (record) => (
      <Button
        key="sync"
        type="link"
        size="small"
        loading={isActing(record, 'sync')}
        onClick={() => handleSync(record)}
      >
        补齐任务
      </Button>
    ),
    close: (record) => (
      <Button
        key="close"
        type="link"
        size="small"
        danger
        loading={isActing(record, 'close')}
        onClick={() => handleClose(record)}
      >
        截止
      </Button>
    ),
    reopen: (record) => (
      <Button
        key="reopen"
        type="link"
        size="small"
        loading={isActing(record, 'reopen')}
        onClick={() => handleReopen(record)}
      >
        重新开启
      </Button>
    ),
    compute: () => (
      <Tooltip key="compute" title="跑批计算功能开发中">
        <span>
          <Button type="link" size="small" disabled>
            跑批计算
          </Button>
        </span>
      </Tooltip>
    ),
    publish: () => (
      <Tooltip key="publish" title="结果发布功能开发中">
        <span>
          <Button type="link" size="small" disabled>
            发布结果
          </Button>
        </span>
      </Tooltip>
    ),
  };

  const columns: ProColumns<PeriodItem>[] = [
    {
      title: '周期',
      dataIndex: 'code',
      width: 120,
      render: (_, record) => formatPeriodTitle(record.code),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      valueEnum: PERIOD_STATUS_VALUE_ENUM,
    },
    {
      title: '填报开始',
      dataIndex: 'openAt',
      width: 170,
      render: (_, record) =>
        record.openAt ? (
          record.openAt.replace('T', ' ').slice(0, 16)
        ) : (
          <span style={{ color: '#bfbfbf' }}>未设置</span>
        ),
    },
    {
      title: '填报截止',
      dataIndex: 'closeAt',
      width: 170,
      render: (_, record) =>
        record.closeAt ? (
          record.closeAt.replace('T', ' ').slice(0, 16)
        ) : (
          <span style={{ color: '#bfbfbf' }}>未设置</span>
        ),
    },
    {
      title: '提交进度',
      dataIndex: 'taskRate',
      width: 160,
      render: (_, record) => (
        <Space size={8}>
          <Progress
            type="circle"
            size={40}
            strokeWidth={10}
            percent={toPercent(record.taskRate)}
            format={(value) => `${Math.round(value ?? 0)}%`}
          />
          <span>
            {record.taskDone ?? 0} / {record.taskTotal ?? 0}
          </span>
        </Space>
      ),
    },
    {
      title: '创建人',
      dataIndex: 'createdByName',
      width: 110,
      render: (_, record) =>
        record.createdByName ? (
          record.createdByName
        ) : (
          <span style={{ color: '#bfbfbf' }}>未知</span>
        ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 230,
      fixed: 'right',
      render: (_, record) =>
        (CYCLE_ACTIONS[record.status] ?? ['progress']).map((key) =>
          ACTION_RENDER[key](record),
        ),
    },
  ];

  return (
    <PageContainer
      title="周期列表"
      content="按月开启评价周期，开启时按当前评价关系物化待评任务。同一时间只允许一个周期进行中，截止后可重新开启补填。"
    >
      <ProTable<PeriodItem, PeriodQueryParams>
        headerTitle="评价周期"
        actionRef={actionRef}
        rowKey="id"
        search={false}
        scroll={{ x: 1180 }}
        toolBarRender={() => [
          <Button key="refresh" icon={<ReloadOutlined />} onClick={reload}>
            刷新
          </Button>,
          <PeriodModalForm
            key="create"
            onSuccess={reload}
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新建周期
              </Button>
            }
          />,
        ]}
        request={async (params) => {
          try {
            const res = await queryPeriods({
              current: params.current,
              pageSize: params.pageSize,
            });
            return {
              data: res?.data ?? [],
              total: res?.total ?? 0,
              success: res?.success ?? false,
            };
          } catch {
            return { data: [], total: 0, success: false };
          }
        }}
        columns={columns}
      />
    </PageContainer>
  );
};

export default CycleList;
