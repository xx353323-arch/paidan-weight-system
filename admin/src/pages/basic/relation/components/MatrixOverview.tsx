import {
  CheckOutlined,
  MinusOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { ProTable } from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Modal, Space, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import { useMemo, useState } from 'react';
import type { CoverageCheckItem, RelationEmployee } from '../data.d';
import { fetchCoverageCheck, fetchMatrix } from '../service';

const ROLE_COLOR: Record<string, string> = {
  editor_lead: 'blue',
  delivery: 'green',
  cs: 'orange',
  hr: 'purple',
};

const useStyles = createStyles(({ token, css }) => ({
  dangerRow: css`
    > td {
      background-color: ${token.colorErrorBg} !important;
    }
    &:hover > td {
      background-color: ${token.colorErrorBgHover} !important;
    }
  `,
  covered: css`
    color: ${token.colorSuccess};
  `,
  missing: css`
    color: ${token.colorTextQuaternary};
  `,
}));

const coverageColor = (value: number) => {
  if (value >= 0.9) return 'green';
  if (value >= 0.6) return 'blue';
  if (value >= 0.45) return 'orange';
  return 'red';
};

const MatrixOverview = () => {
  const { styles } = useStyles();
  const [checkOpen, setCheckOpen] = useState(false);

  const matrixQuery = useQuery({
    queryKey: ['relation', 'matrix'],
    queryFn: async () => (await fetchMatrix()).data,
  });

  const checkQuery = useQuery({
    queryKey: ['relation', 'coverage-check'],
    queryFn: async () => (await fetchCoverageCheck()).data,
    enabled: checkOpen,
  });

  const raters = matrixQuery.data?.raters ?? [];
  const employees = matrixQuery.data?.employees ?? [];
  const summary = matrixQuery.data?.summary;

  const coveredSet = useMemo(() => {
    const set = new Set<string>();
    (matrixQuery.data?.cells ?? []).forEach((cell) => {
      set.add(`${cell.employeeId}-${cell.raterUserId}-${cell.roleCode}`);
    });
    return set;
  }, [matrixQuery.data]);

  const columns: ProColumns<RelationEmployee>[] = [
    {
      title: '编辑',
      dataIndex: 'name',
      width: 170,
      fixed: 'left',
      render: (_, record) => (
        <Space size={4} direction="vertical">
          <Space size={6}>
            <span style={{ fontWeight: 500 }}>{record.name}</span>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {record.empNo}
            </Typography.Text>
          </Space>
          <Space size={[4, 4]} wrap>
            {record.tags.map((tag) => (
              <Tag key={tag.id} color={tag.color}>
                {tag.name}
              </Tag>
            ))}
          </Space>
        </Space>
      ),
    },
    ...raters.map<ProColumns<RelationEmployee>>((rater) => ({
      title: (
        <Space direction="vertical" size={2}>
          <span>{rater.displayName}</span>
          <Tag color={ROLE_COLOR[rater.roleCode] ?? 'default'}>
            {rater.roleLabel}
          </Tag>
        </Space>
      ),
      key: `rater-${rater.userId}-${rater.roleCode}`,
      align: 'center',
      width: 110,
      render: (_, record) =>
        coveredSet.has(`${record.id}-${rater.userId}-${rater.roleCode}`) ? (
          <CheckOutlined className={styles.covered} />
        ) : (
          <MinusOutlined className={styles.missing} />
        ),
    })),
    {
      title: '评价人数',
      dataIndex: 'raterCount',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const count = record.raterCount ?? 0;
        return <Tag color={count < 2 ? 'red' : 'default'}>{count} 人</Tag>;
      },
    },
    {
      title: '覆盖度',
      dataIndex: 'nominalCoverage',
      width: 110,
      align: 'center',
      render: (_, record) => {
        const value = record.nominalCoverage ?? 0;
        return (
          <Tag color={coverageColor(value)}>{(value * 100).toFixed(0)}%</Tag>
        );
      },
    },
  ];

  const checkColumns: ProColumns<CoverageCheckItem>[] = [
    {
      title: '编辑',
      dataIndex: 'name',
      width: 120,
      render: (_, record) => `${record.empNo} ${record.name}`,
    },
    {
      title: '已覆盖角色',
      dataIndex: 'coveredRoleLabels',
      render: (_, record) => (
        <Space size={[4, 4]} wrap>
          {record.coveredRoleLabels.map((label) => (
            <Tag key={label} color="green">
              {label}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '缺失角色',
      dataIndex: 'missingRoleLabels',
      render: (_, record) =>
        record.missingRoleLabels.length > 0 ? (
          <Space size={[4, 4]} wrap>
            {record.missingRoleLabels.map((label) => (
              <Tag key={label} color="red">
                {label}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">无</Typography.Text>
        ),
    },
    {
      title: '评价人数',
      dataIndex: 'raterCount',
      width: 90,
      align: 'center',
    },
    {
      title: '名义覆盖度',
      dataIndex: 'nominalCoverage',
      width: 110,
      align: 'center',
      render: (_, record) => (
        <Tag color={coverageColor(record.nominalCoverage)}>
          {(record.nominalCoverage * 100).toFixed(0)}%
        </Tag>
      ),
    },
  ];

  const alertType = (() => {
    if (!summary) return 'info';
    if (summary.insufficientCount > 0 || summary.missingLeadCount > 0)
      return 'error';
    if (summary.missingDeliveryCount > 0) return 'warning';
    return 'success';
  })();

  const alertTitle = (() => {
    if (!summary) return '';
    if (summary.insufficientCount > 0)
      return `有 ${summary.insufficientCount} 名编辑评价人不足 2 位，跑批结果不可信`;
    if (summary.missingLeadCount > 0)
      return `有 ${summary.missingLeadCount} 名编辑没有直属主管，跑批闸门无法通过`;
    if (summary.missingDeliveryCount > 0)
      return `有 ${summary.missingDeliveryCount} 名编辑没有交付对接评价，名义覆盖度偏低`;
    return `全部 ${summary.employeeCount} 名在职编辑评价人均不少于 2 位，平均 ${summary.avgRaterCount} 位`;
  })();

  const isRisky = (record: RelationEmployee) =>
    (record.raterCount ?? 0) < 2 ||
    (record.missingRoles ?? []).includes('editor_lead');

  return (
    <>
      {summary ? (
        <Alert
          type={alertType}
          showIcon
          style={{ marginBottom: 16 }}
          title={alertTitle}
          description={
            <Space direction="vertical" size={2}>
              {summary.insufficientNames.length > 0 ? (
                <span>评价人不足：{summary.insufficientNames.join('、')}</span>
              ) : null}
              {summary.missingLeadNames.length > 0 ? (
                <span>没有直属主管：{summary.missingLeadNames.join('、')}</span>
              ) : null}
              {summary.missingDeliveryNames.length > 0 ? (
                <span>
                  没有交付对接：{summary.missingDeliveryNames.join('、')}
                </span>
              ) : null}
              <span>
                当前 {summary.raterCount} 位评价人，共 {summary.cellCount}{' '}
                条覆盖关系，人事与客服按全员自动展开
              </span>
            </Space>
          }
        />
      ) : null}

      <ProTable<RelationEmployee>
        rowKey="id"
        size="small"
        search={false}
        options={false}
        pagination={false}
        loading={matrixQuery.isFetching}
        dataSource={employees}
        columns={columns}
        scroll={{ x: 'max-content' }}
        rowClassName={(record) => (isRisky(record) ? styles.dangerRow : '')}
        headerTitle="编辑与评价人覆盖矩阵"
        toolBarRender={() => [
          <Button
            key="check"
            icon={<SafetyCertificateOutlined />}
            onClick={() => setCheckOpen(true)}
          >
            覆盖度检查
          </Button>,
          <Button
            key="reload"
            type="primary"
            onClick={() => matrixQuery.refetch()}
          >
            刷新
          </Button>,
        ]}
      />

      <Modal
        open={checkOpen}
        onCancel={() => setCheckOpen(false)}
        footer={null}
        width={880}
        title="跑批前覆盖度检查"
      >
        {checkQuery.data ? (
          <Alert
            type={
              checkQuery.data.summary.blockedCount > 0 ? 'error' : 'success'
            }
            showIcon
            style={{ marginBottom: 12 }}
            title={
              checkQuery.data.summary.blockedCount > 0
                ? `${checkQuery.data.summary.blockedCount} 名编辑未通过闸门，建议补齐后再开周期`
                : '全部在职编辑通过闸门，可以开周期'
            }
            description={`平均名义覆盖度 ${(checkQuery.data.summary.avgNominalCoverage * 100).toFixed(0)}%，角色权重取自算法配置表`}
          />
        ) : null}
        <ProTable<CoverageCheckItem>
          rowKey="employeeId"
          size="small"
          search={false}
          options={false}
          toolBarRender={false}
          pagination={false}
          loading={checkQuery.isFetching}
          dataSource={checkQuery.data?.items ?? []}
          columns={checkColumns}
          rowClassName={(record) => (record.passed ? '' : styles.dangerRow)}
        />
      </Modal>
    </>
  );
};

export default MatrixOverview;
