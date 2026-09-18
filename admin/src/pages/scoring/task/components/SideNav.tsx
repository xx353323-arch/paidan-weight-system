import { Typography } from 'antd';
import { LOCAL_STATUS_META, NAV_GROUP_ORDER } from '../constants';
import type { LocalStatus, ScoringTarget } from '../data.d';
import { useScoringStyles } from '../styles';

type SideNavProps = {
  targets: ScoringTarget[];
  statusOf: (employeeId: number) => LocalStatus;
  onJump: (employeeId: number) => void;
};

const SideNav = ({ targets, statusOf, onJump }: SideNavProps) => {
  const { styles } = useScoringStyles();

  const buckets = new Map<LocalStatus, ScoringTarget[]>();
  targets.forEach((target) => {
    const status = statusOf(target.employeeId);
    if (!buckets.has(status)) buckets.set(status, []);
    buckets.get(status)?.push(target);
  });

  return (
    <div className={styles.navCard}>
      <Typography.Text strong style={{ fontSize: 13 }}>
        人员导航
      </Typography.Text>
      {NAV_GROUP_ORDER.map((status) => {
        const rows = buckets.get(status);
        if (!rows || rows.length === 0) return null;
        const meta = LOCAL_STATUS_META[status];
        return (
          <div key={status}>
            <div className={styles.navGroupTitle}>
              {meta.label} {rows.length} 人
            </div>
            {rows.map((target) => (
              <div
                key={target.employeeId}
                className={styles.navItem}
                onClick={() => onJump(target.employeeId)}
              >
                <span
                  className={styles.navDot}
                  style={{ background: meta.color }}
                />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {target.name}
                </span>
                <Typography.Text
                  type="secondary"
                  style={{ fontSize: 11, marginLeft: 'auto' }}
                >
                  {target.empNo}
                </Typography.Text>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

export default SideNav;
