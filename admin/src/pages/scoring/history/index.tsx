import { PageContainer, ProDescriptions, ProTable } from '@ant-design/pro-components';
import type { ProColumns, ProDescriptionsColumn } from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Drawer, Empty, Space, Tag, Typography } from 'antd';
import React, { useState } from 'react';
import {
  HISTORY_STATUS_VALUE_ENUM,
  SCORE_TEXT,
  SCORE_TONE,
  UNKNOWN_HINT,
  UNKNOWN_TEXT,
  formatClock,
  formatPeriodTitle,
  formatScore,
} from './constants';
import type { HistoryRecord } from './data.d';
import { queryHistory, queryPeriodOptions } from './service';

const ScoringHistory: React.FC = () => {
  const [current, setCurrent] = useState<HistoryRecord | null>(null);

  const { data: periodOptions = [] } = useQuery({
    queryKey: ['history-periods'],
    queryFn: queryPeriodOptions,
    staleTime: 5 * 60 * 1000,
  });

  const overviewColumns: ProDescriptionsColumn<HistoryRecord>[] = [
    { title: '被评编辑', key: 'employeeName', render: (_, entity) => entity.employeeName },
    { title: '工号', key: 'empNo', render: (_, entity) => entity.empNo },
    { title: '我的身份', key: 'roleLabel', render: (_, entity) => entity.roleLabel || entity.roleCode },
    { title: '熟悉程度', key: 'familiarityLabel', render: (_, entity) => entity.familiarityLabel },
    { title: '提交时间', key: 'submittedAt', render: (_, entity) => formatClock(entity.submittedAt) || '-' },
    {
      title: '加权得分',
      key: 'rawScore',
      render: (_, entity) =>
        entity.status === 'UNKNOWN' ? UNKNOWN_TEXT : `${formatScore(entity.rawScore)} / 5`,
    },
  ];

  const columns: ProColumns<HistoryRecord>[] = [
    {
      title: '评价周期',
      dataIndex: 'periodId',
      valueType: 'select',
      fieldProps: { options: periodOptions, placeholder: '全部周期' },
      render: (_, record) => formatPeriodTitle(record.periodCode),
      width: 120,
    },
    {
      title: '被评编辑',
      dataIndex: 'employeeName',
      search: false,
      render: (_, record) => (
        <Space size={4}>
          <span style={{ fontWeight: 500 }}>{record.employeeName}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.empNo}
          </Typography.Text>
        </Space>
      ),
      width: 160,
    },
    {
      title: '我的身份',
      dataIndex: 'roleLabel',
      search: false,
      width: 130,
      render: (_, record) => <Tag>{record.roleLabel || record.roleCode}</Tag>,
    },
    {
      title: '熟悉程度',
      dataIndex: 'familiarityLabel',
      search: false,
      width: 110,
    },
    {
      title: '加权得分',
      dataIndex: 'rawScore',
      search: false,
      width: 110,
      render: (_, record) => {
        if (record.status === 'UNKNOWN') {
          return <Typography.Text type="secondary">{UNKNOWN_TEXT}</Typography.Text>;
        }
        return (
          <Space size={4}>
            <span style={{ fontSize: 16, fontWeight: 600 }}>{formatScore(record.rawScore)}</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              / 5
            </Typography.Text>
          </Space>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      valueType: 'select',
      valueEnum: HISTORY_STATUS_VALUE_ENUM,
      search: false,
      width: 100,
    },
    {
      title: '提交时间',
      dataIndex: 'submittedAt',
      search: false,
      width: 170,
      render: (_, record) => formatClock(record.submittedAt) || '-',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 90,
      fixed: 'right',
      render: (_, record) => [
        <Button key="detail" type="link" size="small" onClick={() => setCurrent(record)}>
          查看明细
        </Button>,
      ],
    },
  ];

  return (
    <PageContainer
      title="我的评价记录"
      content="这里是你历次提交过的评价，提交后不可修改，如需更正请联系管理员"
    >
      <ProTable<HistoryRecord>
        rowKey={(record) => `${record.periodId}-${record.employeeId}-${record.roleCode}`}
        columns={columns}
        search={{ labelWidth: 80, defaultCollapsed: false }}
        pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        scroll={{ x: 1000 }}
        request={async (params) =>
          queryHistory({
            periodId: params.periodId as number | undefined,
            current: params.current,
            pageSize: params.pageSize,
          })
        }
        locale={{
          emptyText: <Empty description="本期你还没有提交过评价" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
        }}
      />

      <Drawer
        open={Boolean(current)}
        onClose={() => setCurrent(null)}
        width={560}
        title={current ? `${current.employeeName} · ${formatPeriodTitle(current.periodCode)}` : ''}
      >
        {current ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <ProDescriptions<HistoryRecord>
              column={2}
              dataSource={current}
              columns={overviewColumns}
            />

            {current.status === 'UNKNOWN' ? (
              <Alert type="info" showIcon title={UNKNOWN_HINT} />
            ) : (
              <div>
                <Typography.Title level={5} style={{ marginBottom: 12 }}>
                  各项评分
                </Typography.Title>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {current.items.map((item) => (
                    <div
                      key={item.label}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 8,
                        background: 'rgba(0,0,0,0.02)',
                      }}
                    >
                      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 500 }}>{item.label}</span>
                        <Space size={8}>
                          <span style={{ color: SCORE_TONE[item.score], fontWeight: 600, fontSize: 16 }}>
                            {item.score} 分
                          </span>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            {SCORE_TEXT[item.score]}
                          </Typography.Text>
                        </Space>
                      </Space>
                      {item.comment ? (
                        <Typography.Paragraph
                          type="secondary"
                          style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}
                        >
                          {item.comment}
                        </Typography.Paragraph>
                      ) : null}
                    </div>
                  ))}
                </Space>
              </div>
            )}
          </Space>
        ) : null}
      </Drawer>
    </PageContainer>
  );
};

export default ScoringHistory;
