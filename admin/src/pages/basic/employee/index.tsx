import { PlusOutlined, TagsOutlined } from '@ant-design/icons';
import type { ActionType, ProColumns } from '@ant-design/pro-components';
import {
  FooterToolbar,
  ModalForm,
  PageContainer,
  ProFormRadio,
  ProFormSelect,
  ProTable,
} from '@ant-design/pro-components';
import { useMutation } from '@tanstack/react-query';
import { Button, message, Space, Tag } from 'antd';
import type React from 'react';
import { useRef, useState } from 'react';
import EmployeeModalForm from './components/EmployeeModalForm';
import StatusModalForm from './components/StatusModalForm';
import { EMPLOYMENT_STATUS_VALUE_ENUM } from './constants';
import type {
  EmployeeBatchTagValues,
  EmployeeItem,
  EmployeeQueryParams,
} from './data.d';
import {
  batchTagEmployees,
  fetchLeadOptions,
  fetchActiveTagOptions,
  fetchTagOptions,
  queryEmployees,
} from './service';

const EmployeeManage: React.FC = () => {
  const actionRef = useRef<ActionType | null>(null);
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedRows, setSelectedRows] = useState<EmployeeItem[]>([]);

  const reload = () => {
    actionRef.current?.reload();
  };

  const { mutateAsync: runBatchTag, isPending: batchLoading } = useMutation({
    mutationFn: batchTagEmployees,
    onSuccess: (res) => {
      messageApi.success(`已更新 ${res?.data?.updated ?? 0} 名员工的标签`);
      setSelectedRows([]);
      actionRef.current?.reloadAndRest?.();
    },
  });

  const columns: ProColumns<EmployeeItem>[] = [
    {
      title: '姓名或工号',
      dataIndex: 'keyword',
      hideInTable: true,
      fieldProps: { placeholder: '输入姓名或工号模糊查询' },
    },
    {
      title: '姓名',
      dataIndex: 'name',
      search: false,
      width: 110,
    },
    {
      title: '工号',
      dataIndex: 'empNo',
      search: false,
      sorter: true,
      width: 110,
    },
    {
      title: '在职状态',
      dataIndex: 'employmentStatus',
      valueType: 'select',
      width: 110,
      valueEnum: EMPLOYMENT_STATUS_VALUE_ENUM,
    },
    {
      title: '直属主管',
      dataIndex: 'leadUserId',
      valueType: 'select',
      width: 130,
      fieldProps: { placeholder: '按主管筛选', allowClear: true },
      request: fetchLeadOptions,
      render: (_, record) =>
        record.leadName ? (
          record.leadName
        ) : (
          <span style={{ color: '#bfbfbf' }}>未指定</span>
        ),
    },
    {
      title: '擅长领域标签',
      dataIndex: 'tagIds',
      valueType: 'select',
      fieldProps: {
        mode: 'multiple',
        placeholder: '按标签筛选',
        allowClear: true,
      },
      request: fetchTagOptions,
      render: (_, record) =>
        record.tags?.length ? (
          <Space size={[4, 4]} wrap>
            {record.tags.map((item) => (
              <Tag key={item.id} color={item.color}>
                {item.name}
              </Tag>
            ))}
          </Space>
        ) : (
          <span style={{ color: '#bfbfbf' }}>暂无标签</span>
        ),
    },
    {
      title: '入职日期',
      dataIndex: 'hiredAt',
      valueType: 'date',
      search: false,
      sorter: true,
      width: 120,
    },
    {
      title: '关联账号',
      dataIndex: 'username',
      search: false,
      width: 120,
      render: (_, record) =>
        record.username ? (
          record.username
        ) : (
          <span style={{ color: '#bfbfbf' }}>未开通</span>
        ),
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      render: (_, record) => [
        <EmployeeModalForm
          key="edit"
          values={record}
          onSuccess={reload}
          trigger={
            <Button type="link" size="small">
              编辑
            </Button>
          }
        />,
        <StatusModalForm
          key="status"
          record={record}
          onSuccess={reload}
          trigger={
            <Button type="link" size="small">
              变更状态
            </Button>
          }
        />,
      ],
    },
  ];

  return (
    <PageContainer
      title="员工档案"
      content="维护编辑名单、在职状态与擅长领域标签。员工不做物理删除，离职后仅标记状态，历史评价数据保留。"
    >
      {contextHolder}
      <ProTable<EmployeeItem, EmployeeQueryParams>
        headerTitle="编辑名单"
        actionRef={actionRef}
        rowKey="id"
        search={{ labelWidth: 100 }}
        scroll={{ x: 1100 }}
        toolBarRender={() => [
          <EmployeeModalForm
            key="create"
            onSuccess={reload}
            trigger={
              <Button type="primary" icon={<PlusOutlined />}>
                新建员工
              </Button>
            }
          />,
        ]}
        request={async (params, sort) => {
          const sorterEntries = Object.entries(sort ?? {}).map(
            ([field, order]) =>
              `${field}:${order === 'ascend' ? 'asc' : 'desc'}`,
          );
          const tagIds = (params as Record<string, any>).tagIds;
          try {
            const res = await queryEmployees({
              current: params.current,
              pageSize: params.pageSize,
              keyword: params.keyword || undefined,
              employmentStatus: params.employmentStatus,
              leadUserId: params.leadUserId,
              tagIds: Array.isArray(tagIds)
                ? tagIds.join(',') || undefined
                : tagIds,
              sorter: sorterEntries.length
                ? sorterEntries.join(',')
                : undefined,
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
        rowSelection={{
          onChange: (_, rows) => setSelectedRows(rows),
          selectedRowKeys: selectedRows.map((item) => item.id),
        }}
      />
      {selectedRows.length > 0 && (
        <FooterToolbar
          extra={
            <span>
              已选择{' '}
              <span style={{ fontWeight: 600 }}>{selectedRows.length}</span>{' '}
              名员工
            </span>
          }
        >
          <Button onClick={() => setSelectedRows([])}>取消选择</Button>
          <ModalForm<Omit<EmployeeBatchTagValues, 'employeeIds'>>
            title="批量打标签"
            width={480}
            layout="horizontal"
            labelCol={{ span: 6 }}
            wrapperCol={{ span: 16 }}
            trigger={
              <Button type="primary" icon={<TagsOutlined />}>
                批量打标签
              </Button>
            }
            modalProps={{
              destroyOnHidden: true,
              okButtonProps: { loading: batchLoading },
              okText: '确认',
              cancelText: '取消',
            }}
            initialValues={{ mode: 'append', tagIds: [] }}
            onFinish={async (values) => {
              try {
                await runBatchTag({
                  employeeIds: selectedRows.map((item) => item.id),
                  tagIds: values.tagIds ?? [],
                  mode: values.mode,
                });
                return true;
              } catch {
                return false;
              }
            }}
          >
            <ProFormSelect
              name="tagIds"
              label="擅长领域"
              mode="multiple"
              allowClear
              placeholder="选择要打上的标签"
              request={fetchActiveTagOptions}
            />
            <ProFormRadio.Group
              name="mode"
              label="写入方式"
              options={[
                { label: '追加', value: 'append' },
                { label: '覆盖', value: 'replace' },
              ]}
              extra="追加保留原有标签，覆盖会清空原有标签后重写"
            />
          </ModalForm>
        </FooterToolbar>
      )}
    </PageContainer>
  );
};

export default EmployeeManage;
