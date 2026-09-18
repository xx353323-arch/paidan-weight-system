import { TrophyOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import type { TableColumnsType } from 'antd';
import { Alert, Button, Card, Empty, Space, Table, Tag, Tooltip } from 'antd';
import Trend from '@/pages/dashboard/analysis/components/Trend';
import { bizMessage, GRADE_META, RANK_COLOR } from '../constants';
import type { RankingItem } from '../data.d';
import { useWorkbenchStyles } from '../styles';

type DispatchCardProps = {
  items: RankingItem[];
  loading: boolean;
  error: unknown;
};

const DispatchCard = ({ items, loading, error }: DispatchCardProps) => {
  const { styles } = useWorkbenchStyles();

  const columns: TableColumnsType<RankingItem> = [
    {
      title: '排名',
      dataIndex: 'rankNo',
      width: 64,
      align: 'center',
      render: (_, record, index) => {
        const rank = record.rankNo ?? index + 1;
        const color = RANK_COLOR[rank];
        return (
          <span
            style={{
              fontWeight: color ? 700 : 500,
              color,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {rank}
          </span>
        );
      },
    },
    {
      title: '姓名',
      dataIndex: 'name',
      render: (_, record) => (
        <Space size={6} wrap>
          <span className={styles.rankName}>{record.name}</span>
          {record.tags?.slice(0, 1).map((tag) => (
            <Tag key={tag.id} color={tag.color}>
              {tag.name}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '权重分',
      dataIndex: 'wFinal',
      width: 118,
      align: 'right',
      render: (_, record) => (
        <Space size={4}>
          <span className={styles.rankScore}>{record.wFinal.toFixed(2)}</span>
          {record.delta ? (
            <Trend flag={record.delta > 0 ? 'up' : 'down'}>
              {Math.abs(record.delta).toFixed(2)}
            </Trend>
          ) : null}
        </Space>
      ),
    },
    {
      title: '档位',
      dataIndex: 'gradeCode',
      width: 70,
      align: 'center',
      render: (_, record) => {
        const meta = GRADE_META[record.gradeCode];
        return (
          <Tooltip title={meta ? `${record.gradeCode} 档 ${meta.range}` : ''}>
            <Tag color={meta?.color ?? 'default'}>{record.gradeCode}</Tag>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Card
      title={
        <Space size={6}>
          <TrophyOutlined />
          派单参考前十
        </Space>
      }
      loading={loading}
      style={{ height: '100%' }}
    >
      {error ? (
        <Alert
          type="error"
          showIcon
          title="排行榜加载失败"
          description={bizMessage(error, '请稍后重试或刷新页面')}
        />
      ) : items.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="还没有发布的评价结果"
        />
      ) : (
        <Table<RankingItem>
          rowKey="employeeId"
          size="small"
          pagination={false}
          columns={columns}
          dataSource={items}
        />
      )}
      <div className={styles.cardFooter}>
        <Button type="link" onClick={() => history.push('/dispatch')}>
          查看完整排行
        </Button>
      </div>
    </Card>
  );
};

export default DispatchCard;
