import { FieldTimeOutlined } from '@ant-design/icons';
import { ProCard } from '@ant-design/pro-components';
import { Skeleton, Space, Tag, Tooltip, Typography } from 'antd';
import { clsx } from 'clsx';
import { useEffect, useState } from 'react';
import {
  DAY_MS,
  formatClock,
  formatPeriodTitle,
  greetingOf,
  PERIOD_STATUS_TAG_COLOR,
} from '../constants';
import type { PeriodInfo } from '../data.d';
import { useWorkbenchStyles } from '../styles';

type WelcomeBarProps = {
  name: string;
  roleText: string;
  period: PeriodInfo | null;
  loading: boolean;
};

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
  return deadline - now;
}

function splitRemain(remain: number) {
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

const WelcomeBar = ({ name, roleText, period, loading }: WelcomeBarProps) => {
  const { styles } = useWorkbenchStyles();
  const remain = useCountdown(period?.closeAt);
  const expired = remain !== null && remain <= 0;
  const urgent = remain !== null && remain > 0 && remain < DAY_MS;
  const greeting = greetingOf(new Date().getHours());

  const periodText = period
    ? `当前周期 ${formatPeriodTitle(period.code)}`
    : '系统里还没有评价周期';

  return (
    <ProCard className={styles.welcome}>
      {loading ? (
        <Skeleton active paragraph={{ rows: 1 }} title={{ width: 220 }} />
      ) : (
        <div className={styles.welcomeRow}>
          <div>
            <div className={styles.greeting}>
              {name ? `${name}，${greeting}` : greeting}
            </div>
            <div className={styles.subGreeting}>
              <Space size={8} wrap>
                <span>{roleText}</span>
                <span>{periodText}</span>
                {period ? (
                  <Tag
                    color={PERIOD_STATUS_TAG_COLOR[period.status] ?? 'default'}
                  >
                    {period.statusLabel}
                  </Tag>
                ) : null}
              </Space>
            </div>
          </div>

          {period?.closeAt ? (
            <Tooltip title={`截止时间 ${formatClock(period.closeAt)}`}>
              <div className={styles.deadline}>
                <div
                  className={clsx(styles.deadlineValue, {
                    [styles.deadlineUrgent]: urgent || expired,
                  })}
                >
                  <Space size={6}>
                    <FieldTimeOutlined />
                    {expired ? '已过截止时间' : splitRemain(remain ?? 0)}
                  </Space>
                </div>
                <div className={styles.deadlineLabel}>
                  {expired
                    ? `截止于 ${formatClock(period.closeAt)}`
                    : urgent
                      ? '距离截止不足一天，请尽快提交'
                      : '距离本期截止'}
                </div>
              </div>
            </Tooltip>
          ) : (
            <Typography.Text type="secondary">本期没有设置截止时间</Typography.Text>
          )}
        </div>
      )}
    </ProCard>
  );
};

export default WelcomeBar;
