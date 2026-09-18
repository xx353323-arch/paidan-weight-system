import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ProColumns } from '@ant-design/pro-components';
import {
  PageContainer,
  ProTable,
  StatisticCard,
} from '@ant-design/pro-components';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAccess } from '@umijs/max';
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Input,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import { clsx } from 'clsx';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import TagSelect from '@/components/TagSelect';
import Trend from '@/pages/dashboard/analysis/components/Trend';
import ScoreDetailDrawer from './components/ScoreDetailDrawer';
import {
  coverageColor,
  DISPATCH_QUERY_KEY,
  EMPLOYMENT_STATUS_META,
  formatDateTime,
  formatDelta,
  formatScore,
  GRADE_META,
  GRADE_OPTIONS,
  gradeColor,
  RANKING_PAGE_SIZE,
  ROLE_FALLBACK_LABEL,
  TIE_HINT,
} from './constants';
import type { RankingItem, TieInfo } from './data.d';
import {
  fetchDispatchTags,
  fetchPeriodMetaMap,
  fetchResultPeriods,
  queryRanking,
} from './service';
import { useDispatchStyles } from './styles';

const Dispatch: React.FC = () => {
  const { styles } = useDispatchStyles();
  const { message } = App.useApp();
  const access = useAccess();

  const [periodId, setPeriodId] = useState<number>();
  const [includeDraft, setIncludeDraft] = useState(false);
  const [selectedTags, setSelectedTags] = useState<(string | number)[]>([]);
  const [grade, setGrade] = useState('ALL');
  const [keyword, setKeyword] = useState('');
  const [searchText, setSearchText] = useState('');
  const [detailTarget, setDetailTarget] = useState<RankingItem | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchText(keyword.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [keyword]);

  const periodsQuery = useQuery({
    queryKey: [DISPATCH_QUERY_KEY, 'periods'],
    queryFn: fetchResultPeriods,
    staleTime: 60 * 1000,
  });

  const periodMetaQuery = useQuery({
    queryKey: [DISPATCH_QUERY_KEY, 'period-meta'],
    queryFn: fetchPeriodMetaMap,
    staleTime: 60 * 1000,
  });

  const tagsQuery = useQuery({
    queryKey: [DISPATCH_QUERY_KEY, 'tags'],
    queryFn: fetchDispatchTags,
    staleTime: 5 * 60 * 1000,
  });

  const periodOptions = useMemo(() => {
    const list = periodsQuery.data ?? [];
    return includeDraft ? list : list.filter((item) => item.isPublished);
  }, [periodsQuery.data, includeDraft]);

  useEffect(() => {
    if (periodOptions.length === 0) {
      if (periodId) setPeriodId(undefined);
      return;
    }
    if (periodOptions.some((item) => item.value === periodId)) return;
    const published = periodOptions.find((item) => item.isPublished);
    setPeriodId((published ?? periodOptions[0]).value);
  }, [periodOptions, periodId]);

  const tagIdsParam = selectedTags.length ? selectedTags.join(',') : undefined;

  const overviewQuery = useQuery({
    queryKey: [DISPATCH_QUERY_KEY, 'overview', periodId, includeDraft],
    queryFn: () =>
      queryRanking(
        {
          periodId,
          includeDraft: includeDraft || undefined,
          current: 1,
          pageSize: RANKING_PAGE_SIZE,
        },
        true,
      ),
    enabled: Boolean(periodId),
  });

  const listQuery = useQuery({
    queryKey: [
      DISPATCH_QUERY_KEY,
      'list',
      periodId,
      includeDraft,
      searchText,
      grade,
      tagIdsParam,
    ],
    queryFn: () =>
      queryRanking({
        periodId,
        includeDraft: includeDraft || undefined,
        keyword: searchText || undefined,
        grade: grade === 'ALL' ? undefined : grade,
        tagIds: tagIdsParam,
        current: 1,
        pageSize: RANKING_PAGE_SIZE,
      }),
    enabled: Boolean(periodId),
    placeholderData: keepPreviousData,
  });

  const overviewItems = useMemo(
    () => overviewQuery.data?.data ?? [],
    [overviewQuery.data],
  );
  const listItems = useMemo(() => listQuery.data?.data ?? [], [listQuery.data]);
  const [groupMode, setGroupMode] = useState(true);

  const tieMap = useMemo(() => {
    const groups = new Map<string, RankingItem[]>();
    overviewItems.forEach((item) => {
      const key = formatScore(item.wFinal);
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    });
    const result = new Map<number, TieInfo>();
    groups.forEach((list) => {
      const ranks = list
        .map((item) => item.rankNo)
        .filter((value): value is number => typeof value === 'number');
      const rank = ranks.length ? Math.min(...ranks) : null;
      list.forEach((item) => {
        result.set(item.employeeId, { rank, tied: list.length > 1 });
      });
    });
    return result;
  }, [overviewItems]);

  const selectedTagIds = useMemo(
    () => new Set(selectedTags.map((value) => Number(value))),
    [selectedTags],
  );

  const currentPeriod = periodOptions.find((item) => item.value === periodId);
  const periodMeta = periodId ? periodMetaQuery.data?.[periodId] : undefined;
  const joinCount = overviewQuery.data?.total ?? 0;
  const averageScore = overviewItems.length
    ? overviewItems.reduce((sum, item) => sum + item.wFinal, 0) /
      overviewItems.length
    : null;
  const publishedText = periodMeta?.publishedAt
    ? formatDateTime(periodMeta.publishedAt)
    : '未发布';

  const rankOf = (record: RankingItem) => {
    if (groupMode) return record.groupRank ?? null;
    return tieMap.get(record.employeeId)?.rank ?? record.rankNo ?? null;
  };

  const groupedItems = useMemo(() => {
    const buckets = new Map<string, RankingItem[]>();
    listItems.forEach((item) => {
      const key = item.groupName || '未分组';
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(item);
    });
    return Array.from(buckets.entries())
      .map(([name, rows]) => ({ name, rows, sort: rows[0]?.groupSort ?? 9999 }))
      .sort((a, b) => a.sort - b.sort);
  }, [listItems]);

  const handleExport = () => {
    if (!listItems.length) {
      message.warning('当前筛选条件下没有可导出的数据');
      return;
    }
    const header = [
      '层级',
      groupMode ? '组内排名' : '排名',
      '姓名',
      '工号',
      '权重分',
      '较上期',
      '档位',
      '擅长领域',
      '评价覆盖',
      '有效样本量',
      '在职状态',
      '标记',
    ];
    const rows = listItems.map((item) => {
      const tie = tieMap.get(item.employeeId);
      const flags = [
        item.isFrozen ? '已冻结' : '',
        item.isCarryForward ? '沿用上期' : '',
        item.floorApplied ? '新人保护' : '',
        tie?.tied ? '并列' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return [
        item.groupName || '未分组',
        String(rankOf(item) ?? ''),
        item.name,
        item.empNo,
        formatScore(item.wFinal),
        item.delta === null || item.delta === undefined
          ? '首期'
          : formatDelta(item.delta),
        item.gradeCode ?? '',
        item.tags.map((tag) => tag.name).join(' '),
        item.coverageLabel ?? '',
        formatScore(item.effectiveN),
        EMPLOYMENT_STATUS_META[item.employmentStatus]?.text ??
          item.employmentStatus,
        flags,
      ];
    });
    const csv = [header, ...rows]
      .map((line) =>
        line
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\r\n');
    const blob = new Blob([`${String.fromCharCode(0xfeff)}${csv}`], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `派单参考_${currentPeriod?.code ?? '最新'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    message.success(`已导出 ${listItems.length} 条记录`);
  };

  const columns: ProColumns<RankingItem>[] = [
    {
      title: groupMode ? '组内排名' : '排名',
      dataIndex: 'rankNo',
      width: 96,
      align: 'center',
      render: (_, record) => {
        const tie = tieMap.get(record.employeeId);
        const rank = rankOf(record);
        const badgeClass = clsx(
          styles.rankBadge,
          rank === 1 && styles.rankGold,
          rank === 2 && styles.rankSilver,
          rank === 3 && styles.rankBronze,
        );
        return (
          <Space size={4}>
            <span className={badgeClass}>{rank ?? '-'}</span>
            {tie?.tied && (
              <Tooltip title={TIE_HINT}>
                <Tag color="orange" variant="filled">
                  并列
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: 190,
      render: (_, record) => (
        <Space size={4} wrap>
          <Button
            type="link"
            className={styles.nameButton}
            onClick={() => setDetailTarget(record)}
          >
            {record.name}
          </Button>
          {record.isFrozen && (
            <Tooltip title="分数已被人工冻结，本期不随评价变动">
              <Tag color="default" variant="filled">
                已冻结
              </Tag>
            </Tooltip>
          )}
          {record.isCarryForward && (
            <Tooltip title="本期评价证据不足，沿用上期权重分">
              <Tag color="purple" variant="filled">
                沿用上期
              </Tag>
            </Tooltip>
          )}
          {record.floorApplied && (
            <Tooltip title="新人保护，分数已按保底线抬到下限">
              <Tag color="gold" variant="filled">
                新人保护
              </Tag>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '工号',
      dataIndex: 'empNo',
      width: 90,
    },
    {
      title: '权重分',
      dataIndex: 'wFinal',
      width: 220,
      render: (_, record) => {
        const tie = tieMap.get(record.employeeId);
        return (
          <div>
            <div className={styles.scoreCell}>
              <span className={styles.scoreValue}>
                {formatScore(record.wFinal)}
              </span>
              {record.delta === null || record.delta === undefined ? (
                <span className={styles.scoreBand}>首期</span>
              ) : record.delta === 0 ? (
                <span className={styles.scoreBand}>持平</span>
              ) : (
                <Trend reverseColor flag={record.delta > 0 ? 'up' : 'down'}>
                  {formatDelta(record.delta)}
                </Trend>
              )}
            </div>
            {tie?.tied && (
              <Typography.Text
                type="warning"
                style={{ fontSize: 12, lineHeight: '18px' }}
              >
                {TIE_HINT}
              </Typography.Text>
            )}
          </div>
        );
      },
    },
    {
      title: '档位',
      dataIndex: 'gradeCode',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Tooltip title={GRADE_META[record.gradeCode]?.desc ?? ''}>
          <Tag color={gradeColor(record.gradeCode)}>
            {record.gradeCode ?? '-'}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: '擅长领域',
      dataIndex: 'tags',
      width: 190,
      render: (_, record) =>
        record.tags?.length ? (
          <Space size={[4, 4]} wrap>
            {record.tags.map((tag) => {
              const hit = selectedTagIds.has(tag.id);
              return (
                <Tag
                  key={tag.id}
                  color={tag.color}
                  className={clsx(
                    hit && styles.tagHit,
                    selectedTagIds.size > 0 && !hit && styles.tagDim,
                  )}
                >
                  {tag.name}
                </Tag>
              );
            })}
          </Space>
        ) : (
          <Typography.Text type="secondary">暂无标签</Typography.Text>
        ),
    },
    {
      title: '评价覆盖',
      dataIndex: 'coverageLabel',
      width: 150,
      render: (_, record) => (
        <Space size={6}>
          <Tag color={coverageColor(record.coverageLevel)} variant="filled">
            {record.coverageLabel || '-'}
          </Tag>
          {record.missingRoles?.length > 0 && (
            <Tooltip
              title={`缺 ${record.missingRoles
                .map((role) => ROLE_FALLBACK_LABEL[role] ?? role)
                .join('、')} 的评价`}
            >
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                缺 {record.missingRoles.length} 维
              </Typography.Text>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: '在职状态',
      dataIndex: 'employmentStatus',
      width: 130,
      render: (_, record) => {
        const meta = EMPLOYMENT_STATUS_META[record.employmentStatus];
        return (
          <Space size={4} wrap>
            <Tag color={meta?.color ?? 'default'}>
              {meta?.text ?? record.employmentStatus}
            </Tag>
            {!record.inDispatchPool && (
              <Tooltip title="这名编辑当前不在派单池，请勿派单">
                <Tag color="red" variant="filled">
                  不派单
                </Tag>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  const rowClassName = (record: RankingItem) =>
    clsx(
      tieMap.get(record.employeeId)?.tied && styles.tieRow,
      record.isFrozen && styles.frozenRow,
    );

  const noResult = !periodsQuery.isLoading && periodOptions.length === 0;

  return (
    <PageContainer
      title="派单参考"
      content="按权重分从高到低排列的编辑清单。分数相同的并列显示，按擅长领域标签挑人。点姓名可以看这个人的得分明细。"
    >
      <Space vertical size={16} style={{ width: '100%' }}>
        {noResult && (
          <Alert
            type="info"
            showIcon
            title="还没有可查看的评价结果"
            description="等管理员跑批并发布本期结果之后，这里才会出现排行榜。"
          />
        )}

        <StatisticCard.Group
          direction="row"
          loading={overviewQuery.isLoading || periodsQuery.isLoading}
        >
          <StatisticCard
            statistic={{
              title: '当前周期',
              value: currentPeriod?.label ?? '暂无',
            }}
          />
          <StatisticCard.Divider />
          <StatisticCard
            statistic={{
              title: '结果状态',
              value: currentPeriod
                ? currentPeriod.isPublished
                  ? '已发布'
                  : '草稿'
                : '-',
              formatter: (value) => (
                <Tag
                  color={currentPeriod?.isPublished ? 'success' : 'default'}
                  variant="filled"
                >
                  {value}
                </Tag>
              ),
            }}
          />
          <StatisticCard.Divider />
          <StatisticCard
            statistic={{ title: '参与人数', value: joinCount, suffix: '人' }}
          />
          <StatisticCard.Divider />
          <StatisticCard
            statistic={{
              title: '平均分',
              value: averageScore === null ? '-' : formatScore(averageScore),
            }}
          />
          <StatisticCard.Divider />
          <StatisticCard
            statistic={{ title: '发布时间', value: publishedText }}
          />
        </StatisticCard.Group>

        <Card>
          <div className={styles.filterRow}>
            <div className={styles.filterBlock}>
              <span className={styles.filterLabel}>周期</span>
              <Select
                style={{ width: 170 }}
                value={periodId}
                placeholder="选择周期"
                loading={periodsQuery.isLoading}
                onChange={(value) => setPeriodId(value)}
                options={periodOptions.map((item) => ({
                  value: item.value,
                  label: item.isPublished
                    ? item.label
                    : `${item.label}（草稿）`,
                }))}
              />
            </div>
            <div className={styles.filterBlock}>
              <span className={styles.filterLabel}>档位</span>
              <Segmented
                options={GRADE_OPTIONS}
                value={grade}
                onChange={(value) => setGrade(String(value))}
              />
            </div>
            <div className={styles.filterBlock}>
              <Input.Search
                allowClear
                style={{ width: 220 }}
                placeholder="按姓名或工号查找"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                onSearch={(value) => setSearchText(value.trim())}
              />
            </div>
            {access.canAdmin && (
              <div className={styles.filterBlock}>
                <Checkbox
                  checked={includeDraft}
                  onChange={(event) => setIncludeDraft(event.target.checked)}
                >
                  包含未发布草稿
                </Checkbox>
              </div>
            )}
          </div>
          <div className={styles.tagArea} style={{ marginTop: 12 }}>
            <span className={styles.filterLabel}>擅长领域</span>
            <TagSelect
              hideCheckAll
              value={selectedTags}
              onChange={(value) => setSelectedTags(value)}
            >
              {(tagsQuery.data ?? []).map((tag) => (
                <TagSelect.Option key={tag.id} value={tag.id}>
                  {tag.name}
                </TagSelect.Option>
              ))}
            </TagSelect>
            {selectedTags.length > 0 && (
              <Button
                type="link"
                size="small"
                onClick={() => setSelectedTags([])}
              >
                清空
              </Button>
            )}
          </div>
        </Card>

        {groupMode ? (
          groupedItems.map((group, index) => (
            <ProTable<RankingItem>
              key={group.name}
              headerTitle={
                <Space size={10} align="center">
                  <Tag
                    color={group.name === '未分组' ? 'default' : 'processing'}
                    variant="filled"
                    style={{ fontSize: 15, padding: '4px 12px', margin: 0 }}
                  >
                    {group.name}
                  </Tag>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>
                    {group.name === '未分组' ? '未设置层级' : `${group.name}组排行`}
                  </span>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    共 {group.rows.filter((r) => !r.isFrozen).length} 人，独立排名
                  </Typography.Text>
                </Space>
              }
              rowKey="employeeId"
              search={false}
              options={false}
              pagination={false}
              scroll={{ x: 1180 }}
              loading={listQuery.isFetching}
              dataSource={group.rows}
              columns={columns}
              rowClassName={rowClassName}
              toolBarRender={
                index === 0
                  ? () => [
                      <Segmented
                        key="mode"
                        value="group"
                        options={[
                          { label: '分层级排名', value: 'group' },
                          { label: '全员排名', value: 'all' },
                        ]}
                        onChange={(value) => setGroupMode(value === 'group')}
                      />,
                      <Button
                        key="refresh"
                        icon={<ReloadOutlined />}
                        loading={listQuery.isFetching}
                        onClick={() => {
                          listQuery.refetch();
                          overviewQuery.refetch();
                        }}
                      >
                        刷新
                      </Button>,
                      <Button
                        key="export"
                        type="primary"
                        icon={<DownloadOutlined />}
                        onClick={handleExport}
                      >
                        导出CSV
                      </Button>,
                    ]
                  : () => []
              }
            />
          ))
        ) : (
          <ProTable<RankingItem>
            headerTitle={`权重排行榜（${listItems.length} 人）`}
            rowKey="employeeId"
            search={false}
            options={false}
            pagination={false}
            scroll={{ x: 1180 }}
            loading={listQuery.isFetching}
            dataSource={listItems}
            columns={columns}
            rowClassName={rowClassName}
            toolBarRender={() => [
              <Segmented
                key="mode"
                value="all"
                options={[
                  { label: '分层级排名', value: 'group' },
                  { label: '全员排名', value: 'all' },
                ]}
                onChange={(value) => setGroupMode(value === 'group')}
              />,
              <Button
                key="refresh"
                icon={<ReloadOutlined />}
                loading={listQuery.isFetching}
                onClick={() => {
                  listQuery.refetch();
                  overviewQuery.refetch();
                }}
              >
                刷新
              </Button>,
              <Button
                key="export"
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleExport}
              >
                导出CSV
              </Button>,
            ]}
          />
        )}
      </Space>

      <ScoreDetailDrawer
        open={Boolean(detailTarget)}
        employeeId={detailTarget?.employeeId}
        employeeName={detailTarget?.name}
        periodId={periodId}
        periodLabel={currentPeriod?.label}
        onClose={() => setDetailTarget(null)}
      />
    </PageContainer>
  );
};

export default Dispatch;
