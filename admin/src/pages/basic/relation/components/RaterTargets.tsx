import { CopyOutlined, TeamOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import { FooterToolbar, ProCard, ProTable } from '@ant-design/pro-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Divider,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
} from 'antd';
import { createStyles } from 'antd-style';
import { useEffect, useMemo, useState } from 'react';
import type {
  BizErrorInfo,
  RaterItem,
  RelationEmployee,
  SaveTargetsParams,
} from '../data.d';
import {
  copyFromLast,
  fetchRaters,
  fetchTargets,
  saveTargets,
} from '../service';

const ROLE_COLOR: Record<string, string> = {
  editor_lead: 'blue',
  delivery: 'green',
  cs: 'orange',
  hr: 'purple',
};

const useStyles = createStyles(({ token, css }) => ({
  raterItem: css`
    padding: 10px 12px;
    cursor: pointer;
    border-left: 3px solid transparent;
    border-bottom: 1px solid ${token.colorSplit};
    transition: background-color 0.2s;
    &:hover {
      background-color: ${token.colorFillTertiary};
    }
  `,
  raterItemActive: css`
    background-color: ${token.colorPrimaryBg};
    border-left-color: ${token.colorPrimary};
    &:hover {
      background-color: ${token.colorPrimaryBg};
    }
  `,
  disabledTable: css`
    opacity: 0.55;
    pointer-events: none;
    user-select: none;
  `,
}));

const raterKey = (item: RaterItem) => `${item.userId}-${item.roleCode}`;

const RaterTargets = () => {
  const { styles, cx } = useStyles();
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();

  const [activeKey, setActiveKey] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [coverageAll, setCoverageAll] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [tagFilter, setTagFilter] = useState<number[]>([]);
  const [leadFilter, setLeadFilter] = useState<number[]>([]);

  const ratersQuery = useQuery({
    queryKey: ['relation', 'raters'],
    queryFn: async () => (await fetchRaters()).data,
  });

  const raters = useMemo(() => ratersQuery.data ?? [], [ratersQuery.data]);
  const activeRater = useMemo(
    () => raters.find((item) => raterKey(item) === activeKey),
    [raters, activeKey],
  );

  useEffect(() => {
    if (!activeKey && raters.length > 0) {
      setActiveKey(raterKey(raters[0]));
    }
  }, [raters, activeKey]);

  const targetsQuery = useQuery({
    queryKey: [
      'relation',
      'targets',
      activeRater?.userId,
      activeRater?.roleCode,
    ],
    queryFn: async () => {
      if (!activeRater) return null;
      return (await fetchTargets(activeRater.userId, activeRater.roleCode))
        .data;
    },
    enabled: Boolean(activeRater),
  });

  const baselineIds = useMemo(
    () => targetsQuery.data?.targetIds ?? [],
    [targetsQuery.data],
  );
  const baselineAll = targetsQuery.data?.coverageMode === 'ALL';

  useEffect(() => {
    if (targetsQuery.data) {
      setSelectedIds(targetsQuery.data.targetIds);
      setCoverageAll(targetsQuery.data.coverageMode === 'ALL');
      setKeyword('');
      setTagFilter([]);
      setLeadFilter([]);
    }
  }, [targetsQuery.data]);

  const employees = useMemo(
    () => targetsQuery.data?.employees ?? [],
    [targetsQuery.data],
  );
  const employeeNameMap = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach((item) => {
      map.set(item.id, item.name);
    });
    return map;
  }, [employees]);

  const tagOptions = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach((item) => {
      item.tags.forEach((tag) => {
        map.set(tag.id, tag.name);
      });
    });
    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [employees]);

  const leadOptions = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach((item) => {
      if (item.leadUserId && item.leadName)
        map.set(item.leadUserId, item.leadName);
    });
    return Array.from(map.entries()).map(([value, label]) => ({
      value,
      label,
    }));
  }, [employees]);

  const filteredEmployees = useMemo(() => {
    const text = keyword.trim().toLowerCase();
    return employees.filter((item) => {
      if (
        text &&
        !item.name.toLowerCase().includes(text) &&
        !item.empNo.toLowerCase().includes(text)
      ) {
        return false;
      }
      if (
        tagFilter.length > 0 &&
        !item.tags.some((tag) => tagFilter.includes(tag.id))
      )
        return false;
      if (leadFilter.length > 0 && !leadFilter.includes(item.leadUserId ?? 0))
        return false;
      return true;
    });
  }, [employees, keyword, tagFilter, leadFilter]);

  const addedIds = useMemo(
    () => selectedIds.filter((id) => !baselineIds.includes(id)),
    [selectedIds, baselineIds],
  );
  const removedIds = useMemo(
    () => baselineIds.filter((id) => !selectedIds.includes(id)),
    [selectedIds, baselineIds],
  );
  const loaded = Boolean(
    targetsQuery.data &&
      activeRater &&
      targetsQuery.data.raterUserId === activeRater.userId &&
      targetsQuery.data.roleCode === activeRater.roleCode,
  );
  const modeChanged = coverageAll !== baselineAll;
  const dirty =
    loaded &&
    (modeChanged ||
      (!coverageAll && (addedIds.length > 0 || removedIds.length > 0)));

  const saveMutation = useMutation({
    mutationFn: async (payload: SaveTargetsParams) => {
      if (!activeRater) throw new Error('未选择评价人');
      return saveTargets(activeRater.userId, payload);
    },
    onSuccess: (res) => {
      const data = res.data;
      message.success(
        data.coverageMode === 'ALL'
          ? '已改为覆盖全体在职编辑'
          : `保存成功，新增 ${data.addedCount} 人，移除 ${data.removedCount} 人，当前 ${data.totalCount} 人`,
      );
      queryClient.invalidateQueries({ queryKey: ['relation'] });
    },
    onError: (error: unknown) => {
      const info = (error as { info?: BizErrorInfo }).info;
      const conflicts = info?.data?.conflicts ?? [];
      if (conflicts.length > 0) {
        modal.error({
          title: '一个编辑只能归属一位主管',
          width: 460,
          content: (
            <div>
              <p>以下员工已经归属其他主管，请先由对方移出，再加入本名单。</p>
              {conflicts.map((item) => (
                <p key={item.employeeId} style={{ marginBottom: 4 }}>
                  {item.empNo} {item.name} 现属{' '}
                  <Tag color="blue">{item.currentLeadName}</Tag>
                </p>
              ))}
            </div>
          ),
        });
        return;
      }
      message.error(info?.errorMessage || '保存失败，请稍后重试');
    },
  });

  const copyMutation = useMutation({
    mutationFn: copyFromLast,
    onSuccess: (res) => {
      const data = res.data;
      if (data.applied) {
        message.success(data.message);
        queryClient.invalidateQueries({ queryKey: ['relation'] });
      } else {
        message.info(data.message);
      }
    },
  });

  const resetDraft = () => {
    setSelectedIds(baselineIds);
    setCoverageAll(baselineAll);
  };

  const switchRater = (item: RaterItem) => {
    const next = raterKey(item);
    if (next === activeKey) return;
    if (dirty) {
      modal.confirm({
        title: '当前修改尚未保存',
        content: '切换评价人会丢弃尚未保存的勾选调整，确认切换？',
        okText: '丢弃并切换',
        cancelText: '留在本页',
        onOk: () => setActiveKey(next),
      });
      return;
    }
    setActiveKey(next);
  };

  const submit = () => {
    if (!activeRater || !loaded) return;
    const payload: SaveTargetsParams = coverageAll
      ? { roleCode: activeRater.roleCode, targetIds: [], coverageMode: 'ALL' }
      : {
          roleCode: activeRater.roleCode,
          targetIds: selectedIds,
          coverageMode: 'EXPLICIT',
        };
    const removedNames = (coverageAll ? baselineIds : removedIds).map(
      (id) => employeeNameMap.get(id) ?? `编号 ${id}`,
    );
    if (removedNames.length === 0) {
      saveMutation.mutate(payload);
      return;
    }
    modal.confirm({
      title: coverageAll ? '确认改为覆盖全体在职编辑' : '确认保存名单调整',
      width: 480,
      okText: '确认保存',
      cancelText: '再看看',
      content: (
        <div>
          <p>
            以下 {removedNames.length} 人将被移出 {activeRater.displayName} 的
            {activeRater.roleLabel}名单，历史评价数据保留，本期起不再派发问卷。
          </p>
          <Space size={[4, 4]} wrap>
            {removedNames.map((name) => (
              <Tag key={name} color="red">
                {name}
              </Tag>
            ))}
          </Space>
          {addedIds.length > 0 && !coverageAll ? (
            <div style={{ marginTop: 12 }}>
              <p style={{ marginBottom: 4 }}>同时新增 {addedIds.length} 人</p>
              <Space size={[4, 4]} wrap>
                {addedIds.map((id) => (
                  <Tag key={id} color="green">
                    {employeeNameMap.get(id)}
                  </Tag>
                ))}
              </Space>
            </div>
          ) : null}
        </div>
      ),
      onOk: () => saveMutation.mutateAsync(payload).catch(() => undefined),
    });
  };

  const columns: ProColumns<RelationEmployee>[] = [
    {
      title: '员工',
      dataIndex: 'name',
      render: (_, record) => (
        <Space size={6}>
          <span style={{ fontWeight: 500 }}>{record.name}</span>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {record.empNo}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 160,
      render: (_, record) =>
        record.tags.length > 0 ? (
          <Space size={[4, 4]} wrap>
            {record.tags.map((tag) => (
              <Tag key={tag.id} color={tag.color}>
                {tag.name}
              </Tag>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">无</Typography.Text>
        ),
    },
    {
      title: '直属主管',
      dataIndex: 'leadName',
      width: 120,
      render: (_, record) =>
        record.leadName ? (
          <Tag color="blue">{record.leadName}</Tag>
        ) : (
          <Tag color="red">未归属</Tag>
        ),
    },
  ];

  const selectFiltered = () => {
    const next = new Set(selectedIds);
    filteredEmployees.forEach((item) => {
      next.add(item.id);
    });
    setSelectedIds(Array.from(next));
  };

  const unselectFiltered = () => {
    const removing = new Set(filteredEmployees.map((item) => item.id));
    setSelectedIds(selectedIds.filter((id) => !removing.has(id)));
  };

  return (
    <>
      <ProCard
        split="vertical"
        variant="borderless"
        styles={{ body: { padding: 0 } }}
      >
        <ProCard colSpan="260px" styles={{ body: { padding: 0 } }}>
          <div style={{ padding: '8px 12px', fontWeight: 500 }}>
            <Space>
              <TeamOutlined />
              评价人
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                共 {raters.length} 位
              </Typography.Text>
            </Space>
          </div>
          <Spin spinning={ratersQuery.isPending}>
            <div>
              {raters.map((item) => (
                <div
                  key={raterKey(item)}
                  className={cx(
                    styles.raterItem,
                    activeKey === raterKey(item) && styles.raterItemActive,
                  )}
                  onClick={() => switchRater(item)}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Space size={6}>
                      <span style={{ fontWeight: 500 }}>
                        {item.displayName}
                      </span>
                      <Tag color={ROLE_COLOR[item.roleCode] ?? 'default'}>
                        {item.roleLabel}
                      </Tag>
                    </Space>
                  </div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {item.coverageMode === 'ALL'
                      ? `全员覆盖 ${item.targetCount} 人`
                      : `已关联 ${item.targetCount} 人`}
                  </Typography.Text>
                </div>
              ))}
            </div>
          </Spin>
        </ProCard>

        <ProCard styles={{ body: { paddingTop: 8 } }}>
          {!activeRater ? (
            <Empty
              description="请选择左侧评价人"
              style={{ padding: '60px 0' }}
            />
          ) : (
            <Spin spinning={targetsQuery.isFetching}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <Space size={8}>
                  <span style={{ fontSize: 16, fontWeight: 500 }}>
                    {activeRater.displayName}
                  </span>
                  <Tag color={ROLE_COLOR[activeRater.roleCode] ?? 'default'}>
                    {activeRater.roleLabel}
                  </Tag>
                  <Typography.Text type="secondary">
                    {coverageAll
                      ? '覆盖全体在职编辑'
                      : `已勾选 ${selectedIds.length} 人`}
                  </Typography.Text>
                </Space>
                <Space size={12}>
                  <Space size={6}>
                    <Switch checked={coverageAll} onChange={setCoverageAll} />
                    <span>覆盖全体在职编辑</span>
                  </Space>
                  <Button
                    icon={<CopyOutlined />}
                    loading={copyMutation.isPending}
                    onClick={() => copyMutation.mutate()}
                  >
                    从上一周期复制
                  </Button>
                </Space>
              </div>

              {coverageAll ? (
                <Alert
                  type="info"
                  showIcon
                  style={{ marginBottom: 12 }}
                  title={`${activeRater.displayName} 评价全员，无需逐个勾选`}
                  description="开周期时由系统按在职名单自动展开，本角色不保留逐人关系。关闭开关可改回按名单勾选。"
                />
              ) : (
                <Space size={8} wrap style={{ marginBottom: 12 }}>
                  <Input.Search
                    allowClear
                    placeholder="搜索姓名或工号"
                    style={{ width: 200 }}
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                  />
                  <Select
                    allowClear
                    mode="multiple"
                    placeholder="按标签筛选"
                    style={{ minWidth: 180 }}
                    options={tagOptions}
                    value={tagFilter}
                    onChange={setTagFilter}
                  />
                  <Select
                    allowClear
                    mode="multiple"
                    placeholder="按直属主管筛选"
                    style={{ minWidth: 180 }}
                    options={leadOptions}
                    value={leadFilter}
                    onChange={setLeadFilter}
                  />
                  <Button type="primary" ghost onClick={selectFiltered}>
                    全选当前筛选结果
                  </Button>
                  <Button onClick={unselectFiltered}>取消当前筛选结果</Button>
                  <Button danger onClick={() => setSelectedIds([])}>
                    清空勾选
                  </Button>
                  <Typography.Text type="secondary">
                    当前筛选出 {filteredEmployees.length} 人
                  </Typography.Text>
                </Space>
              )}

              <div className={coverageAll ? styles.disabledTable : undefined}>
                <ProTable<RelationEmployee>
                  rowKey="id"
                  size="small"
                  search={false}
                  options={false}
                  toolBarRender={false}
                  pagination={false}
                  dataSource={coverageAll ? employees : filteredEmployees}
                  columns={columns}
                  rowSelection={{
                    preserveSelectedRowKeys: true,
                    selectedRowKeys: coverageAll
                      ? employees.map((item) => item.id)
                      : selectedIds,
                    onChange: (keys) => setSelectedIds(keys as number[]),
                    getCheckboxProps: () => ({ disabled: coverageAll }),
                  }}
                  tableAlertRender={false}
                />
              </div>
            </Spin>
          )}
        </ProCard>
      </ProCard>

      {dirty && activeRater ? (
        <FooterToolbar
          extra={
            <Space split={<Divider type="vertical" />}>
              <span>
                {activeRater.displayName} · {activeRater.roleLabel}
              </span>
              {coverageAll ? (
                <span>
                  改为覆盖全体在职编辑，现有 {baselineIds.length}{' '}
                  条名单关系将被清空
                </span>
              ) : (
                <>
                  <span>已选 {selectedIds.length} 人</span>
                  <span
                    style={{
                      color: addedIds.length > 0 ? '#389e0d' : undefined,
                    }}
                  >
                    新增 {addedIds.length} 人
                  </span>
                  <span
                    style={{
                      color: removedIds.length > 0 ? '#cf1322' : undefined,
                    }}
                  >
                    移除 {removedIds.length} 人
                  </span>
                </>
              )}
            </Space>
          }
        >
          <Button onClick={resetDraft}>重置</Button>
          <Button
            type="primary"
            loading={saveMutation.isPending}
            onClick={submit}
          >
            保存
          </Button>
        </FooterToolbar>
      ) : null}
    </>
  );
};

export default RaterTargets;
