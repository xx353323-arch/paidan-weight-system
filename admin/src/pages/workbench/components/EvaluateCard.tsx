import { CheckCircleFilled, EditOutlined } from '@ant-design/icons';
import { history } from '@umijs/max';
import { Alert, Button, Card, Empty, Progress, Space, Tag, Typography } from 'antd';
import { bizMessage, ROLE_COLOR, ROLE_LABEL } from '../constants';
import type { EvaluateOverview } from '../data.d';
import { useWorkbenchStyles } from '../styles';

type EvaluateCardProps = {
  data?: EvaluateOverview;
  loading: boolean;
  error: unknown;
};

const EvaluateCard = ({ data, loading, error }: EvaluateCardProps) => {
  const { styles } = useWorkbenchStyles();
  const summary = data?.summary;
  const total = summary?.total ?? 0;
  const settled = (summary?.submitted ?? 0) + (summary?.unknown ?? 0);
  const percent = total > 0 ? Math.round((settled / total) * 100) : 0;
  const allDone = total > 0 && settled === total;
  const editable = data?.editable ?? false;
  const roleCode = data?.roleCode ?? '';

  const goTask = () => history.push('/scoring/task');
  const goHistory = () => history.push('/scoring/history');

  const renderBody = () => {
    if (error) {
      return (
        <Alert
          type="error"
          showIcon
          title="打分任务加载失败"
          description={bizMessage(error, '请稍后重试或刷新页面')}
        />
      );
    }
    if (!data || total === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="本期没有分配给你的评价任务"
        />
      );
    }
    return (
      <>
        <div className={styles.ringRow}>
          <Progress
            type="circle"
            size={104}
            percent={percent}
            strokeColor={allDone ? '#52c41a' : '#1677ff'}
            format={() => (
              <span style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
                {settled} / {total}
              </span>
            )}
          />
          <div className={styles.ringMeta}>
            <div className={styles.ringHeadline}>
              本期待评
              <span className={styles.ringNumber}>{total}</span>人，已完成
              <span className={styles.ringNumber}>{settled}</span>人
            </div>
            <div className={styles.miniTiles}>
              <div className={styles.miniTile}>
                <span className={styles.miniValue} style={{ color: '#389e0d' }}>
                  {summary?.submitted ?? 0}
                </span>
                <span className={styles.miniLabel}>已提交</span>
              </div>
              <div className={styles.miniTile}>
                <span className={styles.miniValue} style={{ color: '#8c8c8c' }}>
                  {summary?.unknown ?? 0}
                </span>
                <span className={styles.miniLabel}>已跳过</span>
              </div>
              <div className={styles.miniTile}>
                <span className={styles.miniValue} style={{ color: '#1677ff' }}>
                  {summary?.draft ?? 0}
                </span>
                <span className={styles.miniLabel}>草稿中</span>
              </div>
              <div className={styles.miniTile}>
                <span
                  className={styles.miniValue}
                  style={{
                    color: (summary?.pending ?? 0) > 0 ? '#d46b08' : undefined,
                  }}
                >
                  {summary?.pending ?? 0}
                </span>
                <span className={styles.miniLabel}>未开始</span>
              </div>
            </div>
            {allDone ? (
              <Space size={6}>
                <CheckCircleFilled style={{ color: '#52c41a' }} />
                <Typography.Text type="success">
                  本期评价已全部提交
                </Typography.Text>
              </Space>
            ) : editable ? (
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                还有 {total - settled} 人等你打分，填写过程自动保存草稿
              </Typography.Text>
            ) : (
              <Typography.Text type="warning" style={{ fontSize: 13 }}>
                本期已截止，不能再修改打分
              </Typography.Text>
            )}
          </div>
        </div>

        <div className={styles.cardFooter}>
          {allDone ? (
            <>
              <Button onClick={goTask}>查看本期打分</Button>
              <Button type="primary" onClick={goHistory}>
                查看我的评价
              </Button>
            </>
          ) : (
            <>
              <Button onClick={goHistory}>我的评价记录</Button>
              <Button type="primary" icon={<EditOutlined />} onClick={goTask}>
                {editable ? '继续打分' : '查看本期打分'}
              </Button>
            </>
          )}
        </div>
      </>
    );
  };

  return (
    <Card
      title="我的打分任务"
      loading={loading}
      extra={
        roleCode ? (
          <Tag color={ROLE_COLOR[roleCode] ?? 'default'}>
            {data?.roleLabel || ROLE_LABEL[roleCode] || roleCode}
          </Tag>
        ) : null
      }
      style={{ height: '100%' }}
    >
      {renderBody()}
    </Card>
  );
};

export default EvaluateCard;
