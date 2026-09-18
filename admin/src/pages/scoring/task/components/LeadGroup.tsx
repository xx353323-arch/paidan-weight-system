import { MinusCircleOutlined, UndoOutlined } from '@ant-design/icons';
import { Button, Space, Tooltip, Typography } from 'antd';
import type { ReactNode } from 'react';
import { useScoringStyles } from '../styles';

type LeadGroupProps = {
  leadName: string;
  total: number;
  doneCount: number;
  skippedCount: number;
  markableCount: number;
  restorableCount: number;
  readonly: boolean;
  loading: boolean;
  onMarkUnknown: () => void;
  onRestore: () => void;
  children: ReactNode;
};

const LeadGroup = ({
  leadName,
  total,
  doneCount,
  skippedCount,
  markableCount,
  restorableCount,
  readonly,
  loading,
  onMarkUnknown,
  onRestore,
  children,
}: LeadGroupProps) => {
  const { styles } = useScoringStyles();

  return (
    <div>
      <div className={styles.groupHeader}>
        <Space size={10} align="center" wrap>
          <Typography.Text strong style={{ fontSize: 15 }}>
            {leadName}带的
          </Typography.Text>
          <Typography.Text type="secondary">{total} 人</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            已填 {doneCount} 人 · 已跳过 {skippedCount} 人
          </Typography.Text>
        </Space>
        {readonly ? null : (
          <Space size={6}>
            {restorableCount > 0 ? (
              <Button
                size="small"
                icon={<UndoOutlined />}
                disabled={loading}
                onClick={onRestore}
              >
                恢复本组 {restorableCount} 人
              </Button>
            ) : null}
            <Tooltip
              title={
                markableCount === 0
                  ? '本组没有可标记的人'
                  : '一次性把本组还没填的人标记为不了解，标记后这些人不计入你的评价，可以随时单个改回来'
              }
            >
              <Button
                size="small"
                icon={<MinusCircleOutlined />}
                loading={loading}
                disabled={markableCount === 0}
                onClick={onMarkUnknown}
              >
                整组标记为不了解
              </Button>
            </Tooltip>
          </Space>
        )}
      </div>
      {children}
    </div>
  );
};

export default LeadGroup;
