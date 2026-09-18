import React from 'react';
import type { BoardRow } from '../service';
import { useBoardStyles } from '../styles';
import { useCountUp } from '../useCountUp';
import GradeTag from './GradeTag';

type SlotProps = {
  row: BoardRow;
  place: 1 | 2 | 3;
  order: number;
};

const PodiumSlot: React.FC<SlotProps> = ({ row, place, order }) => {
  const { styles, cx } = useBoardStyles();
  const score = useCountUp(row.wFinal, 900, 420 + order * 110);

  const heightClass =
    place === 1
      ? styles.podiumFirst
      : place === 2
        ? styles.podiumSecond
        : styles.podiumThird;
  const medalClass =
    place === 1
      ? styles.medalGold
      : place === 2
        ? styles.medalSilver
        : styles.medalBronze;

  return (
    <div
      className={cx(
        styles.podiumSlot,
        heightClass,
        row.isMe && styles.podiumMine,
      )}
      style={{ '--i': order } as React.CSSProperties}
    >
      {row.isMe && <span className={styles.meChip}>我</span>}
      <span className={cx(styles.medal, medalClass)}>{place}</span>
      <span
        className={cx(
          styles.podiumScore,
          place === 1 && styles.podiumScoreFirst,
        )}
      >
        {score.toFixed(2)}
      </span>
      <GradeTag code={row.gradeCode} />
    </div>
  );
};

type Props = {
  rows: BoardRow[];
};

const Podium: React.FC<Props> = ({ rows }) => {
  const { styles } = useBoardStyles();
  const first = rows.find((r) => r.groupRank === 1);
  const second = rows.find((r) => r.groupRank === 2);
  const third = rows.find((r) => r.groupRank === 3);

  if (!first) return null;

  return (
    <div className={styles.podium}>
      <div>{second && <PodiumSlot row={second} place={2} order={1} />}</div>
      <div>
        <PodiumSlot row={first} place={1} order={0} />
      </div>
      <div>{third && <PodiumSlot row={third} place={3} order={2} />}</div>
    </div>
  );
};

export default Podium;
