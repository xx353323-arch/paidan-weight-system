import { useQuery } from '@tanstack/react-query';
import { useModel } from '@umijs/max';
import { Empty, Spin } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import MyPositionCard from './components/MyPositionCard';
import Podium from './components/Podium';
import RankRow from './components/RankRow';
import TopBar from './components/TopBar';
import { ANONYMOUS_NOTE, BOARD_QUERY_KEY, MINE_NOTE } from './constants';
import { queryBoard } from './service';
import { useBoardStyles } from './styles';

const Board: React.FC = () => {
  const { styles, cx } = useBoardStyles();
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const roles = currentUser?.roles ?? [];
  const onlyEmployee = roles.length > 0 && roles.every((r) => r === 'employee');

  const { data, isLoading } = useQuery({
    queryKey: [BOARD_QUERY_KEY],
    queryFn: async () => (await queryBoard()).data,
    staleTime: 60 * 1000,
  });

  const groups = useMemo(() => data?.groups ?? [], [data]);
  const mine = data?.mine ?? null;
  const [activeGroup, setActiveGroup] = useState<string>('');

  useEffect(() => {
    if (!groups.length) return;
    const preferred =
      mine?.groupName && groups.some((g) => g.groupName === mine.groupName)
        ? mine.groupName
        : groups[0].groupName;
    setActiveGroup((prev) =>
      prev && groups.some((g) => g.groupName === prev) ? prev : preferred,
    );
  }, [groups, mine]);

  const current = groups.find((g) => g.groupName === activeGroup) ?? groups[0];
  const periodLabel = data?.period
    ? `${data.period.year} 年 ${data.period.month} 月`
    : '';
  const restRows = current?.rows.filter((r) => (r.groupRank ?? 0) > 3) ?? [];
  const topScore = current?.rows[0]?.wFinal ?? 0;

  const body = (() => {
    if (isLoading) {
      return (
        <div className={styles.stateCard}>
          <Spin size="large" />
        </div>
      );
    }
    if (!data?.period || !current) {
      return (
        <div className={styles.stateCard}>
          <Empty description="本期评价结果还没有发布，请稍后再来" />
        </div>
      );
    }
    return (
      <>
        {mine ? (
          <MyPositionCard mine={mine} />
        ) : (
          <div
            className={cx(styles.stateCard, styles.enter)}
            style={{ '--i': 0 } as React.CSSProperties}
          >
            你本期没有参与评价，下面是各组的排名情况
          </div>
        )}

        {groups.length > 1 && (
          <div
            className={cx(styles.switcher, styles.enter)}
            style={{ '--i': 1 } as React.CSSProperties}
          >
            <div className={styles.segmented}>
              {groups.map((group) => (
                <button
                  key={group.groupName}
                  type="button"
                  className={cx(
                    styles.segmentItem,
                    group.groupName === current.groupName &&
                      styles.segmentActive,
                  )}
                  onClick={() => setActiveGroup(group.groupName)}
                >
                  {group.groupName}
                  <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.6 }}>
                    {group.total}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Podium key={`podium-${current.groupName}`} rows={current.rows} />

        <div className={styles.list} key={`list-${current.groupName}`}>
          {restRows.map((row, index) => (
            <RankRow
              key={`${current.groupName}-${row.seat}`}
              row={row}
              order={index}
              topScore={topScore}
            />
          ))}
        </div>

        <div className={styles.footer}>
          {ANONYMOUS_NOTE}
          <br />
          {MINE_NOTE}
        </div>
      </>
    );
  })();

  return (
    <div className={cx(styles.page, !onlyEmployee && styles.embedded)}>
      <div className={styles.orbLayer}>
        <div className={cx(styles.orb, styles.orbOne)} />
        <div className={cx(styles.orb, styles.orbTwo)} />
        <div className={cx(styles.orb, styles.orbThree)} />
      </div>
      <div className={styles.inner}>
        {onlyEmployee && (
          <TopBar
            periodLabel={periodLabel}
            userName={currentUser?.name ?? ''}
          />
        )}
        {body}
      </div>
    </div>
  );
};

export default Board;
