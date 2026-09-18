import type { ProColumns } from '@ant-design/pro-components';
import { EditableProTable, PageContainer } from '@ant-design/pro-components';
import { Alert, Button, message, Popconfirm, Select, Switch, Tag } from 'antd';
import type React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addTag,
  bizMessage,
  editTag,
  queryTags,
  removeTag,
  switchTagActive,
  type TagRow,
} from './service';

const COLOR_OPTIONS = [
  { value: 'blue', label: '蓝色' },
  { value: 'purple', label: '紫色' },
  { value: 'green', label: '绿色' },
  { value: 'orange', label: '橙色' },
  { value: 'red', label: '红色' },
  { value: 'cyan', label: '青色' },
  { value: 'magenta', label: '洋红' },
  { value: 'gold', label: '金色' },
  { value: 'lime', label: '柠檬绿' },
  { value: 'volcano', label: '火山红' },
  { value: 'geekblue', label: '极客蓝' },
];

const COLOR_LABEL: Record<string, string> = COLOR_OPTIONS.reduce(
  (acc, item) => {
    acc[item.value] = item.label;
    return acc;
  },
  {} as Record<string, string>,
);

const MAX_SORT_ORDER = 9999;

const isPersisted = (record: TagRow) =>
  typeof record.id === 'number' && record.id > 0;

const TagManage: React.FC = () => {
  const [dataSource, setDataSource] = useState<readonly TagRow[]>([]);
  const [editableKeys, setEditableRowKeys] = useState<React.Key[]>([]);
  const [loading, setLoading] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const draftIdRef = useRef(0);

  const loadTags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await queryTags();
      setDataSource(res.data ?? []);
    } catch (error) {
      messageApi.error(bizMessage(error, '标签列表加载失败，请刷新重试'));
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    void loadTags();
  }, [loadTags]);

  const handleToggleGroup = useCallback(
    async (record: TagRow, checked: boolean) => {
      if (!isPersisted(record)) return;
      try {
        const res = await editTag(record.id, { isGroup: checked, isActive: record.isActive });
        if (res?.success === false) {
          messageApi.error(res.errorMessage || '设置失败，请重试');
          return;
        }
        messageApi.success(
          checked ? `已把「${record.name}」设为排名分组` : `已取消「${record.name}」的排名分组`,
        );
        await loadTags();
      } catch (error) {
        messageApi.error(bizMessage(error, '设置失败，请重试'));
      }
    },
    [loadTags, messageApi],
  );

  const handleToggle = useCallback(
    async (record: TagRow) => {
      try {
        const res = await switchTagActive(record.id);
        const next = res.data;
        setDataSource((prev) =>
          prev.map((item) =>
            item.id === next.id ? { ...item, ...next } : item,
          ),
        );
        messageApi.success(
          next.isActive ? `已启用「${next.name}」` : `已停用「${next.name}」`,
        );
      } catch (error) {
        messageApi.error(bizMessage(error, '启用停用失败，请重试'));
        void loadTags();
      }
    },
    [loadTags, messageApi],
  );

  const handleDelete = useCallback(
    async (record: TagRow) => {
      try {
        await removeTag(record.id);
        messageApi.success(`已删除标签「${record.name}」`);
        void loadTags();
      } catch (error) {
        messageApi.error(bizMessage(error, '删除失败，请重试'));
        void loadTags();
      }
    },
    [loadTags, messageApi],
  );

  const handleSave = useCallback(
    async (_key: React.Key | React.Key[], record: TagRow) => {
      const name = (record.name ?? '').trim();
      if (!name) {
        messageApi.error('标签名称不能为空');
        return false;
      }
      const payload = {
        name,
        color: record.color || 'blue',
        sortOrder: Number(record.sortOrder) || 0,
      };
      try {
        if (isPersisted(record)) {
          await editTag(record.id, payload);
          messageApi.success(`已保存标签「${name}」`);
        } else {
          await addTag(payload);
          messageApi.success(`已新增标签「${name}」`);
        }
      } catch (error) {
        messageApi.error(bizMessage(error, '保存失败，请重试'));
        return false;
      }
      void loadTags();
      return true;
    },
    [loadTags, messageApi],
  );

  const renderDeleteAction = (record: TagRow) => {
    if (!isPersisted(record)) {
      return null;
    }
    const used = record.employeeCount ?? 0;
    if (used > 0) {
      return (
        <Popconfirm
          key="delete"
          title={`该标签已被 ${used} 名员工使用`}
          description={
            <div style={{ maxWidth: 260 }}>
              删除会连带清空这些员工的擅长领域，派单筛选随之失准。建议改为停用，停用后不再出现在派单筛选项里，已有的员工归属与历史评价全部保留。
            </div>
          }
          okText={record.isActive ? '改为停用' : '当前已停用'}
          okButtonProps={{ disabled: !record.isActive }}
          cancelText="我再想想"
          onConfirm={() => handleToggle(record)}
        >
          <Button type="link" size="small" danger>
            删除
          </Button>
        </Popconfirm>
      );
    }
    return (
      <Popconfirm
        key="delete"
        title={`确认删除标签「${record.name}」`}
        description="当前没有员工使用该标签，删除后不可恢复。"
        okText="确认删除"
        okButtonProps={{ danger: true }}
        cancelText="取消"
        onConfirm={() => handleDelete(record)}
      >
        <Button type="link" size="small" danger>
          删除
        </Button>
      </Popconfirm>
    );
  };

  const columns: ProColumns<TagRow>[] = [
    {
      title: '标签名',
      dataIndex: 'name',
      width: 200,
      formItemProps: {
        rules: [
          { required: true, message: '请填写标签名' },
          { max: 30, message: '标签名最多 30 个字' },
        ],
      },
      render: (_, record) => <Tag color={record.color}>{record.name}</Tag>,
    },
    {
      title: '颜色',
      dataIndex: 'color',
      width: 180,
      formItemProps: {
        rules: [{ required: true, message: '请选择颜色' }],
      },
      render: (_, record) => (
        <Tag color={record.color}>
          {COLOR_LABEL[record.color] ?? record.color}
        </Tag>
      ),
      formItemRender: () => (
        <Select
          placeholder="选择颜色"
          options={COLOR_OPTIONS.map((item) => ({
            value: item.value,
            label: <Tag color={item.value}>{item.label}</Tag>,
          }))}
        />
      ),
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      valueType: 'digit',
      width: 120,
      fieldProps: { min: 0, max: 9999, precision: 0, style: { width: '100%' } },
      formItemProps: {
        rules: [{ required: true, message: '请填写排序值' }],
      },
    },
    {
      title: '启用',
      dataIndex: 'isActive',
      width: 120,
      editable: false,
      render: (_, record) => (
        <Switch
          checked={record.isActive}
          disabled={!isPersisted(record)}
          checkedChildren="启用"
          unCheckedChildren="停用"
          onChange={() => handleToggle(record)}
        />
      ),
    },
    {
      title: '排名分组',
      dataIndex: 'isGroup',
      width: 130,
      editable: false,
      tooltip: '开启后，派单参考页会把带这个标签的人单独分成一组排名',
      render: (_, record) => (
        <Switch
          checked={Boolean(record.isGroup)}
          disabled={!isPersisted(record)}
          checkedChildren="分组"
          unCheckedChildren="不分组"
          onChange={(checked) => handleToggleGroup(record, checked)}
        />
      ),
    },
    {
      title: '引用人数',
      dataIndex: 'employeeCount',
      width: 120,
      editable: false,
      render: (_, record) =>
        isPersisted(record) ? `${record.employeeCount ?? 0} 人` : '—',
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      render: (_, record, __, action) => [
        <Button
          key="edit"
          type="link"
          size="small"
          onClick={() => action?.startEditable?.(record.id)}
        >
          编辑
        </Button>,
        renderDeleteAction(record),
      ],
    },
  ];

  return (
    <PageContainer
      title="标签管理"
      content="标签是编辑的擅长领域，派单时按它筛选人"
    >
      {contextHolder}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        title="标签用于派单时按擅长领域筛选人，停用的标签不再出现在筛选项里，已被员工引用的标签只能停用不能删除。"
      />
      <EditableProTable<TagRow>
        rowKey="id"
        headerTitle="擅长领域标签"
        loading={loading}
        columns={columns}
        value={dataSource}
        onChange={setDataSource}
        recordCreatorProps={{
          position: 'bottom',
          creatorButtonText: '新增标签',
          record: () => {
            draftIdRef.current -= 1;
            const maxSort = dataSource.reduce(
              (acc, item) => Math.max(acc, item.sortOrder ?? 0),
              0,
            );
            return {
              id: draftIdRef.current,
              isGroup: false,
              name: '',
              color: 'blue',
              sortOrder: Math.min(maxSort + 1, MAX_SORT_ORDER),
              isActive: true,
              employeeCount: 0,
            };
          },
        }}
        editable={{
          type: 'multiple',
          editableKeys,
          onChange: setEditableRowKeys,
          onSave: handleSave,
          actionRender: (_row, _config, dom) => [dom.save, dom.cancel],
        }}
      />
    </PageContainer>
  );
};

export default TagManage;
