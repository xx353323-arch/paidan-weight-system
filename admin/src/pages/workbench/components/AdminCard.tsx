import { CheckCircleFilled, SettingOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import {
  Alert,
  Button,
  Card,
  Empty,
  Progress,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  bizMessage,
  formatPeriodTitle,
  PERIOD_STATUS_TAG_COLOR,
  ROLE_COLOR,
  ROLE_LABEL,
  toPercent,
} from '../constants';
import type { PeriodInfo, PeriodProgress } from '../data.d';
import { useWorkbenchStyles } from '../styles';

type AdminCardProps = {
  period: PeriodInfo | null;
  progress?: PeriodProgress;
  loading: boolean;
  error: unknown;
};

const AdminCard = ({ period, progress, loading, error }: AdminCardProps) => {
  const { styles } = useWorkbenchStyles();
  const summary = progress?.summary;
  const percent = toPercent(summary?.rate);
  const unfinished = (progress?.items ?? []).filter(
    (item) => item.state !== 'finished',
  );

  const renderBody = () => {
    if (error) {
      return (
        <Alert
          type="error"
          showIcon
          title="周期进度加载失败"
          description={bizMessage(error, '请稍后重试或刷新页面')}
        />
      );
    }
    if (!period) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="还没有创建评价周期"
        />
      );
    }
    return (
      <Space vertical size={14} style={{ width: '100%' }}>
        <div className={styles.miniTiles}>
          <div className={styles.miniTile}>
            <span className={styles.miniValue}>{summary?.taskTotal ?? 0}</span>
            <span className={styles.miniLabel}>任务总数</span>
          </div>
          <div className={styles.miniTile}>
            <span className={styles.miniValue} style={{ color: '#389e0d' }}>
              {summary?.taskDone ?? 0}
            </span>
            <span className={styles.miniLabel}>已完成</span>
          </div>
          <div className={styles.miniTile}>
            <span className={styles.miniValue}>
              {summary?.raterFinished ?? 0} / {summary?.raterTotal ?? 0}
            </span>
            <span className={styles.miniLabel}>完成的评价人</span>
          </div>
        </div>

        <div>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            总体提交率
          </Typography.Text>
          <Progress
            percent={percent}
            status={percent >= 100 ? 'success' : 'active'}
          />
        </div>

        <div>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            {unfinished.length > 0
              ? `还有 ${unfinished.length} 位评价人没有交齐`
              : '评价人填报情况'}
          </Typography.Text>
          <div className={styles.pendingBox} style={{ marginTop: 6 }}>
            {unfinished.length === 0 ? (
              <Space size={6}>
                <CheckCircleFilled style={{ color: '#52c41a' }} />
                <Typography.Text type="success">
                  全部评价人都已交齐
                </Typography.Text>
              </Space>
            ) : (
              <Space size={[6, 6]} wrap>
                {unfinished.map((item) => (
                  <Tag
                    key={`${item.raterUserId}-${item.roleCode}`}
                    color={ROLE_COLOR[item.roleCode] ?? 'default'}
                  >
                    {item.raterName} · {ROLE_LABEL[item.roleCode] ?? item.roleCode}{' '}
                    {item.done}/{item.total}
                  </Tag>
                ))}
              </Space>
            )}
          </div>
        </div>
      </Space>
    );
  };

  return (
    <Card
      title={
        <Space size={6}>
          <SettingOutlined />
          周期管理概览
        </Space>
      }
      loading={loading}
      extra={
        period ? (
          <Space size={6}>
            <Typography.Text>{formatPeriodTitle(period.code)}</Typography.Text>
            <Tag color={PERIOD_STATUS_TAG_COLOR[period.status] ?? 'default'}>
              {period.statusLabel}
            </Tag>
          </Space>
        ) : null
      }
      style={{ height: '100%' }}
    >
      {renderBody()}
      <div className={styles.cardFooter}>
        <Button onClick={() => history.push('/cycle/list')}>周期管理</Button>
        <Button
          type="primary"
          disabled={!period}
          onClick={() => history.push(`/cycle/progress/${period?.id}`)}
        >
          查看进度
        </Button>
      </div>
    </Card>
  );
};

export default AdminCard;
