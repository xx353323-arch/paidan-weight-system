import { SearchOutlined, TrophyOutlined } from '@ant-design/icons';
import { Helmet } from '@umijs/max';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Col, Empty, Input, Row, Spin, Statistic, Table, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React, { useState } from 'react';
import { lookupMine, queryBoard } from './service';
import type { BoardRow, MyPosition } from './service';

const useStyles = createStyles(({ token }) => ({
  page: {
    minHeight: '100vh',
    padding: '32px 16px 64px',
    background: `linear-gradient(180deg, ${token.colorPrimaryBg} 0%, ${token.colorBgLayout} 320px)`,
  },
  inner: { maxWidth: 960, margin: '0 auto' },
  title: { textAlign: 'center', marginBottom: 4 },
  subtitle: { textAlign: 'center', display: 'block', marginBottom: 28 },
  mineCard: { marginBottom: 24, borderLeft: `4px solid ${token.colorPrimary}` },
  groupCard: { marginBottom: 20 },
  rankCell: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    fontWeight: 600,
    background: token.colorFillSecondary,
  },
  gold: { background: '#faad14', color: '#fff' },
  silver: { background: '#bfbfbf', color: '#fff' },
  bronze: { background: '#d48806', color: '#fff' },
  footer: { textAlign: 'center', marginTop: 32 },
}));

const Board: React.FC = () => {
  const { styles, cx } = useStyles();
  const [keyword, setKeyword] = useState('');
  const [mine, setMine] = useState<MyPosition | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [searching, setSearching] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['public-board'],
    queryFn: async () => (await queryBoard()).data,
    staleTime: 60 * 1000,
  });

  const handleLookup = async (value: string) => {
    const text = value.trim();
    if (!text) return;
    setSearching(true);
    setLookupError('');
    try {
      const res = await lookupMine(text);
      if (res.success && res.data) {
        setMine(res.data);
      } else {
        setMine(null);
        setLookupError(res.errorMessage || '没有找到这个姓名或工号');
      }
    } catch (error: any) {
      setMine(null);
      setLookupError(error?.info?.errorMessage || '查询失败，请稍后重试');
    } finally {
      setSearching(false);
    }
  };

  const columns = [
    {
      title: '名次',
      dataIndex: 'groupRank',
      width: 90,
      align: 'center' as const,
      render: (rank: number | null) => (
        <span
          className={cx(
            styles.rankCell,
            rank === 1 && styles.gold,
            rank === 2 && styles.silver,
            rank === 3 && styles.bronze,
          )}
        >
          {rank ?? '-'}
        </span>
      ),
    },
    {
      title: '权重分',
      dataIndex: 'wFinal',
      align: 'right' as const,
      render: (value: number) => (
        <span style={{ fontSize: 16, fontWeight: 600 }}>{value?.toFixed(2)}</span>
      ),
    },
    {
      title: '档位',
      dataIndex: 'gradeCode',
      width: 90,
      align: 'center' as const,
      render: (code: string | null, record: BoardRow) =>
        code ? <Tag color={record.gradeColor}>{code}</Tag> : '-',
    },
  ];

  const period = data?.period;

  return (
    <div className={styles.page}>
      <Helmet>
        <title>本期派单权重榜</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className={styles.inner}>
        <Typography.Title level={2} className={styles.title}>
          <TrophyOutlined style={{ marginRight: 8 }} />
          派单权重榜
        </Typography.Title>
        <Typography.Text type="secondary" className={styles.subtitle}>
          {period ? `${period.year} 年 ${period.month} 月` : '本期结果尚未发布'}
        </Typography.Text>

        <Card className={styles.mineCard} variant="borderless">
          <Typography.Text strong style={{ display: 'block', marginBottom: 12 }}>
            查看我的排名
          </Typography.Text>
          <Input.Search
            placeholder="输入你的姓名或工号"
            enterButton={<SearchOutlined />}
            size="large"
            loading={searching}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={handleLookup}
            style={{ maxWidth: 420 }}
          />
          {lookupError && (
            <Alert style={{ marginTop: 12 }} type="warning" showIcon title={lookupError} />
          )}
          {mine && (
            <Row gutter={24} style={{ marginTop: 20 }}>
              <Col xs={12} sm={6}>
                <Statistic title="姓名" value={mine.name} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title={`${mine.groupName}组名次`}
                  value={mine.groupRank ?? '-'}
                  suffix={`/ ${mine.groupTotal}`}
                />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic title="权重分" value={mine.wFinal} precision={2} />
              </Col>
              <Col xs={12} sm={6}>
                <Statistic
                  title="档位"
                  valueRender={() =>
                    mine.gradeCode ? (
                      <Tag color={mine.gradeColor} style={{ fontSize: 16, padding: '4px 12px' }}>
                        {mine.gradeCode}
                      </Tag>
                    ) : (
                      <span>-</span>
                    )
                  }
                />
              </Col>
            </Row>
          )}
        </Card>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : !period ? (
          <Card variant="borderless">
            <Empty description="本期评价结果还没有发布，请稍后再来" />
          </Card>
        ) : (
          data?.groups.map((group) => (
            <Card
              key={group.groupName}
              className={styles.groupCard}
              variant="borderless"
              title={
                <span>
                  <Tag color="processing" variant="filled" style={{ fontSize: 14 }}>
                    {group.groupName}
                  </Tag>
                  <span style={{ marginLeft: 8 }}>共 {group.total} 人</span>
                </span>
              }
            >
              <Table<BoardRow>
                rowKey={(record) => `${group.groupName}-${record.groupRank}-${record.wFinal}`}
                columns={columns}
                dataSource={group.rows}
                pagination={false}
                size="middle"
              />
            </Card>
          ))
        )}

        <Typography.Text type="secondary" className={styles.footer} style={{ display: 'block' }}>
          榜单为完全匿名展示，只有名次与分数，不显示任何姓名。查看自己的位置请在上方输入姓名或工号。
        </Typography.Text>
      </div>
    </div>
  );
};

export default Board;
