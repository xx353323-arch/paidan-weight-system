import { TrophyOutlined } from '@ant-design/icons';
import { PageContainer } from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Col, Empty, Row, Spin, Statistic, Table, Tag, Typography } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { queryBoard } from './service';
import type { BoardRow } from './service';

const useStyles = createStyles(({ token }) => ({
  mineCard: {
    marginBottom: 20,
    borderLeft: `4px solid ${token.colorPrimary}`,
    background: token.colorPrimaryBg,
  },
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
  meRow: {
    background: token.colorPrimaryBg,
    fontWeight: 600,
  },
}));

const Board: React.FC = () => {
  const { styles, cx } = useStyles();
  const { data, isLoading } = useQuery({
    queryKey: ['board-ranking'],
    queryFn: async () => (await queryBoard()).data,
    staleTime: 60 * 1000,
  });

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
      title: '',
      dataIndex: 'isMe',
      width: 80,
      render: (isMe: boolean) => (isMe ? <Tag color="blue">我</Tag> : null),
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
  const mine = data?.mine;

  return (
    <PageContainer
      title={
        <span>
          <TrophyOutlined style={{ marginRight: 8 }} />
          派单权重榜
        </span>
      }
      content={period ? `${period.year} 年 ${period.month} 月` : '本期结果尚未发布'}
    >
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <Spin size="large" />
        </div>
      ) : !period ? (
        <Card variant="borderless">
          <Empty description="本期评价结果还没有发布，请稍后再来" />
        </Card>
      ) : (
        <>
          {mine ? (
            <Card className={styles.mineCard} variant="borderless" title="我的位置">
              <Row gutter={24}>
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
                <Col xs={12} sm={6}>
                  <Statistic title="领先" value={mine.aheadOf} suffix="人" />
                </Col>
              </Row>
            </Card>
          ) : (
            <Alert
              style={{ marginBottom: 20 }}
              type="info"
              showIcon
              title="你本期没有参与评价，下面是各组的排名情况"
            />
          )}

          {data?.groups.map((group) => (
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
                rowClassName={(record) => (record.isMe ? styles.meRow : '')}
              />
            </Card>
          ))}

          <Typography.Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
            榜单为匿名展示，只有名次与分数，不显示任何姓名。标记「我」的那一行是你自己。
          </Typography.Text>
        </>
      )}
    </PageContainer>
  );
};

export default Board;
