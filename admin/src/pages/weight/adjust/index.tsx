import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import { PageContainer, ProTable } from '@ant-design/pro-components';
import { Alert, Button, Space, Tag, Tooltip, Typography } from 'antd';
import type React from 'react';
import { useRef } from 'react';
import AdjustDrawerForm from './components/AdjustDrawerForm';
import RevokeModalForm from './components/RevokeModalForm';
import {
  ADJUST_STATUS_VALUE_ENUM,
  ADJUST_TYPE_COLOR,
  ADJUST_TYPE_VALUE_ENUM,
  formatPeriodTitle,
} from './constants';
import type { AdjustmentItem, AdjustmentQueryParams } from './data.d';
import {
  fetchEmployeeOptions,
  fetchPeriodOptions,
  queryAdjustments,
} from './service';

const WeightAdjust: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);

  const reload = () => {
    actionRef.current?.reload();
  };

  const columns: ProColumns<AdjustmentItem>[] = [
    {
      title: '员工',
      dataIndex: 'employeeId',
      valueType: 'select',
      width: 140,
      fieldProps: {
        placeholder: '按员工筛选',
        showSearch: true,
        allowClear: true,
        optionFilterProp: 'label',
      },
      request: fetchEmployeeOptions,
      render: (_, record) => (
        <Space size={4}>
          <span>{record.employeeName}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.empNo}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '调整类型',
      dataIndex: 'adjustType',
      valueType: 'select',
      width: 110,
      valueEnum: ADJUST_TYPE_VALUE_ENUM,
      fieldProps: { placeholder: '按类型筛选', allowClear: true },
    },
    {
      title: '调整值',
      dataIndex: 'valueLabel',
      search: false,
      width: 110,
      render: (_, record) => (
        <Tag color={ADJUST_TYPE_COLOR[record.adjustType] ?? 'default'}>
          {record.valueLabel}
        </Tag>
      ),
    },
    {
      title: '适用周期',
      dataIndex: 'effectiveFromCode',
      search: false,
      width: 190,
      render: (_, record) =>
        record.effectiveToCode ? (
          `${formatPeriodTitle(record.effectiveFromCode)} 至 ${formatPeriodTitle(record.effectiveToCode)}`
        ) : (
          <Space size={4}>
            <span>{formatPeriodTitle(record.effectiveFromCode)} 起</span>
            <Typography.Text type="secondary">长期有效</Typography.Text>
          </Space>
        ),
    },
    {
      title: '原因',
      dataIndex: 'reason',
      search: false,
      ellipsis: true,
      render: (_, record) => (
        <Tooltip title={record.reason} placement="topLeft">
          <span>{record.reason}</span>
        </Tooltip>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      width: 100,
      valueEnum: ADJUST_STATUS_VALUE_ENUM,
      fieldProps: { placeholder: '按状态筛选', allowClear: true },
    },
    {
      title: '适用于周期',
      dataIndex: 'periodId',
      valueType: 'select',
      hideInTable: true,
      fieldProps: { placeholder: '筛选某一期实际覆盖的调整', allowClear: true },
      request: fetchPeriodOptions,
    },
    {
      title: '操作人',
      dataIndex: 'createdByName',
      search: false,
      width: 110,
      render: (_, record) =>
        record.createdByName ? (
          record.createdByName
        ) : (
          <span style={{ color: '#bfbfbf' }}>未知</span>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      valueType: 'dateTime',
      search: false,
      width: 160,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 120,
      fixed: 'right',
      render: (_, record) => {
        if (record.status === 'active') {
          return [
            <RevokeModalForm
              key="revoke"
              record={record}
              onSuccess={reload}
              trigger={
                <Button type="link" size="small" danger>
                  撤销
                </Button>
              }
            />,
          ];
        }
        if (record.status === 'revoked') {
          return [
            <Tooltip
              key="revoked"
              title={`${record.revokedByName ?? '未知'} 撤销：${record.revokeReason ?? ''}`}
            >
              <Typography.Text type="secondary">已撤销</Typography.Text>
            </Tooltip>,
          ];
        }
        return [
          <Typography.Text key="expired" type="secondary">
            已过期
          </Typography.Text>,
        ];
      },
    },
  ];

  return (
    <PageContainer
      title="人工调权"
      content="对指定员工设置乘数、加减分、绝对覆盖或冻结。调权在跑批时叠加到算出的分数上，记录只追加不修改，撤销同样以追加方式留痕。"
    >
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="四种调整按优先级短路生效，不叠加"
        description="冻结最优先，最终分记 0 并退出派单池；其次是绝对覆盖，直接指定最终分，同期乘数与加减分作废；都没有时，先乘所有系数再加所有增减分，结果限制在 0 到 100 分之间。"
      />
      <ProTable<AdjustmentItem, AdjustmentQueryParams>
        headerTitle="调权记录"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 100 }}
        scroll={{ x: 1280 }}
        toolBarRender={() => [
          <Button key="refresh" icon={<ReloadOutlined />} onClick={reload}>
            刷新
          </Button>,
          <AdjustDrawerForm
            key="create"
            onSuccess={reload}
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新建调整
              </Button>
            }
          />,
        ]}
        request={async (params) => {
          try {
            const res = await queryAdjustments({
              current: params.current,
              pageSize: params.pageSize,
              employeeId: params.employeeId,
              status: params.status,
              adjustType: params.adjustType,
              periodId: params.periodId,
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

export default WeightAdjust;
