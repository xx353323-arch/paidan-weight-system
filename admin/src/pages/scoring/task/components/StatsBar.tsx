import {
  CheckCircleFilled,
  CloudSyncOutlined,
  ExclamationCircleFilled,
  FieldTimeOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { Button, Progress, Space, Tooltip, Typography } from 'antd';
import { useEffect, useState } from 'react';
import type { SaveState } from '../data.d';
import { formatClock } from '../helpers';
import { useScoringStyles } from '../styles';

type StatsBarProps = {
  total: number;
  doneCount: number;
  skippedCount: number;
  emptyCount: number;
  partialCount: number;
  closeAt?: string | null;
  saveState: SaveState;
  savedAt: number | null;
  pendingCount: number;
  readonly: boolean;
  onManualSave: () => void;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function useCountdown(closeAt?: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!closeAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [closeAt]);
  if (!closeAt) return null;
  const deadline = new Date(closeAt.replace(' ', 'T')).getTime();
  if (Number.isNaN(deadline)) return null;
  return { remain: deadline - now, deadline };
}

function formatRemain(remain: number) {
  const totalSeconds = Math.floor(remain / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  if (days > 0)
    return `${days} 天 ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

const StatsBar = ({
  total,
  doneCount,
  skippedCount,
  emptyCount,
  partialCount,
  closeAt,
  saveState,
  savedAt,
  pendingCount,
  readonly,
  onManualSave,
}: StatsBarProps) => {
  const { styles } = useScoringStyles();
  const countdown = useCountdown(closeAt);
  const settled = doneCount + skippedCount;
  const percent = total > 0 ? Math.round((settled / total) * 100) : 0;
  const urgent = countdown
    ? countdown.remain > 0 && countdown.remain < DAY_MS
    : false;
  const expired = countdown ? countdown.remain <= 0 : false;

  const tiles = [
    { label: '待评', value: total, color: undefined },
    { label: '已完成', value: doneCount, color: '#389e0d' },
    { label: '已跳过', value: skippedCount, color: '#8c8c8c' },
    {
      label: '未开始',
      value: emptyCount,
      color: emptyCount > 0 ? '#d46b08' : undefined,
    },
  ];

  const saveHint = () => {
    if (readonly) return null;
    if (saveState === 'saving')
      return (
        <Space size={4}>
          <LoadingOutlined />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            正在保存草稿
          </Typography.Text>
        </Space>
      );
    if (saveState === 'error')
      return (
        <Space size={4}>
          <ExclamationCircleFilled style={{ color: '#fa8c16' }} />
          <Typography.Text style={{ fontSize: 12, color: '#d46b08' }}>
            {pendingCount} 人的草稿没保存上
          </Typography.Text>
          <Button size="small" type="link" onClick={onManualSave}>
            手动保存
          </Button>
        </Space>
      );
    if (saveState === 'saved' && savedAt)
      return (
        <Space size={4}>
          <CheckCircleFilled style={{ color: '#52c41a' }} />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            草稿已自动保存 {formatClock(new Date(savedAt).toISOString())}
          </Typography.Text>
        </Space>
      );
    return (
      <Space size={4}>
        <CloudSyncOutlined style={{ color: 'rgba(0,0,0,0.35)' }} />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          填写后自动保存草稿
        </Typography.Text>
      </Space>
    );
  };

  return (
    <div className={styles.statsBar}>
      <div className={styles.statsRow}>
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.statTile}>
            <span className={styles.statValue} style={{ color: tile.color }}>
              {tile.value}
            </span>
            <span className={styles.statLabel}>{tile.label}</span>
          </div>
        ))}

        <div style={{ flex: 1, minWidth: 180 }}>
          <Progress
            percent={percent}
            size="small"
            status={percent === 100 ? 'success' : 'active'}
          />
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {partialCount > 0 ? `其中 ${partialCount} 人只填一半 · ` : ''}
            已处理 {settled} / {total} 人
          </Typography.Text>
        </div>

        <Space direction="vertical" size={0} align="end">
          {countdown ? (
            <Tooltip title={`截止时间 ${closeAt}`}>
              <Space size={4}>
                <FieldTimeOutlined
                  style={{ color: expired || urgent ? '#cf1322' : undefined }}
                />
                <Typography.Text
                  strong={urgent || expired}
                  style={{
                    fontSize: 13,
                    color: expired || urgent ? '#cf1322' : undefined,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {expired
                    ? '已过截止时间'
                    : `距离截止 ${formatRemain(countdown.remain)}`}
                </Typography.Text>
              </Space>
            </Tooltip>
          ) : null}
          {saveHint()}
        </Space>
      </div>
    </div>
  );
};

export default StatsBar;
