import React from 'react';
import type { BoardRow } from '../service';
import { useBoardStyles } from '../styles';
import GradeTag from './GradeTag';

type Props = {
  row: BoardRow;
  order: number;
  topScore: number;
};

const RankRow: React.FC<Props> = ({ row, order, topScore }) => {
  const { styles, cx } = useBoardStyles();
  const ratio = topScore > 0 ? Math.max(0.08, (row.wFinal || 0) / topScore) : 0;

  return (
    <div
      className={cx(styles.row, row.isMe && styles.rowMine)}
      style={{ '--i': order } as React.CSSProperties}
    >
      <span className={styles.rowRank}>{row.groupRank ?? '-'}</span>
      <div className={styles.rowBar}>
        <div
          className={styles.rowBarFill}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <span className={styles.rowScore}>
        {row.isMe && (
          <span className={styles.meChip} style={{ marginRight: 10 }}>
            我
          </span>
        )}
        {row.wFinal?.toFixed(2)}
      </span>
      <GradeTag code={row.gradeCode} />
    </div>
  );
};

export default RankRow;
