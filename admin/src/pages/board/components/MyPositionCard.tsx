import React from 'react';
import type { MyPosition } from '../service';
import { useBoardStyles } from '../styles';
import { useCountUp } from '../useCountUp';
import GradeTag from './GradeTag';

type Props = {
  mine: MyPosition;
};

const MyPositionCard: React.FC<Props> = ({ mine }) => {
  const { styles, cx } = useBoardStyles();
  const score = useCountUp(mine.wFinal, 1000, 260);

  return (
    <div
      className={cx(styles.mineCard, styles.enter)}
      style={{ '--i': 0 } as React.CSSProperties}
    >
      <div className={styles.mineGlow} />
      <div className={styles.mineLabel}>我的位置 · {mine.groupName}组</div>
      <div className={styles.mineGrid}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>组内名次</span>
          <span className={styles.metricValue}>
            {mine.groupRank ?? '-'}
            <span className={styles.metricSuffix}>/ {mine.groupTotal}</span>
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>权重分</span>
          <span className={styles.metricValue}>{score.toFixed(2)}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>档位</span>
          <span className={styles.metricValue} style={{ fontSize: 20 }}>
            <GradeTag code={mine.gradeCode} size="large" />
          </span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>领先</span>
          <span className={styles.metricValue}>
            {mine.aheadOf}
            <span className={styles.metricSuffix}>人</span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default MyPositionCard;
