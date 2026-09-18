import { PageContainer } from '@ant-design/pro-components';
import { useQuery } from '@tanstack/react-query';
import { useAccess, useModel } from '@umijs/max';
import { Col, Empty, Row } from 'antd';
import type React from 'react';
import { useMemo } from 'react';
import AdminCard from './components/AdminCard';
import DispatchCard from './components/DispatchCard';
import EvaluateCard from './components/EvaluateCard';
import WelcomeBar from './components/WelcomeBar';
import { ROLE_LABEL, WORKBENCH_QUERY_KEY } from './constants';
import {
  fetchCurrentPeriod,
  fetchEvaluateOverview,
  fetchPeriodProgress,
  fetchTopRanking,
} from './service';

const Workbench: React.FC = () => {
  const access = useAccess();
  const { initialState } = useModel('@@initialState');
  const currentUser = initialState?.currentUser;
  const userId = currentUser?.userid ?? '';

  const roleText = useMemo(() => {
    const roles = currentUser?.roles ?? [];
    const labels = roles.map((code) => ROLE_LABEL[code] ?? code);
    return labels.length > 0 ? labels.join(' · ') : '未分配角色';
  }, [currentUser]);

  const periodQuery = useQuery({
    queryKey: [WORKBENCH_QUERY_KEY, 'period', userId],
    queryFn: fetchCurrentPeriod,
    enabled: Boolean(userId),
    staleTime: 60 * 1000,
  });

  const evaluateQuery = useQuery({
    queryKey: [WORKBENCH_QUERY_KEY, 'evaluate', userId],
    queryFn: fetchEvaluateOverview,
    enabled: Boolean(userId) && access.canEvaluate,
    staleTime: 30 * 1000,
  });

  const rankingQuery = useQuery({
    queryKey: [WORKBENCH_QUERY_KEY, 'ranking', userId],
    queryFn: () => fetchTopRanking(10),
    enabled: Boolean(userId) && access.canViewDispatch,
    staleTime: 60 * 1000,
  });

  const periodId = periodQuery.data?.id;

  const progressQuery = useQuery({
    queryKey: [WORKBENCH_QUERY_KEY, 'progress', periodId],
    queryFn: () => fetchPeriodProgress(periodId as number),
    enabled: Boolean(access.canAdmin && periodId),
    staleTime: 30 * 1000,
  });

  const cards = useMemo(() => {
    const list: { key: string; node: React.ReactNode }[] = [];
    if (access.canEvaluate) {
      list.push({
        key: 'evaluate',
        node: (
          <EvaluateCard
            data={evaluateQuery.data}
            loading={evaluateQuery.isLoading}
            error={evaluateQuery.error}
          />
        ),
      });
    }
    if (access.canAdmin) {
      list.push({
        key: 'admin',
        node: (
          <AdminCard
            period={periodQuery.data ?? null}
            progress={progressQuery.data}
            loading={periodQuery.isLoading || progressQuery.isLoading}
            error={progressQuery.error}
          />
        ),
      });
    }
    if (access.canViewDispatch) {
      list.push({
        key: 'dispatch',
        node: (
          <DispatchCard
            items={rankingQuery.data ?? []}
            loading={rankingQuery.isLoading}
            error={rankingQuery.error}
          />
        ),
      });
    }
    return list;
  }, [
    access.canEvaluate,
    access.canAdmin,
    access.canViewDispatch,
    evaluateQuery.data,
    evaluateQuery.isLoading,
    evaluateQuery.error,
    periodQuery.data,
    periodQuery.isLoading,
    progressQuery.data,
    progressQuery.isLoading,
    progressQuery.error,
    rankingQuery.data,
    rankingQuery.isLoading,
    rankingQuery.error,
  ]);

  const colProps =
    cards.length === 1
      ? { xs: 24 }
      : cards.length >= 3
        ? { xs: 24, lg: 12, xxl: 8 }
        : { xs: 24, lg: 12 };

  return (
    <PageContainer title={false}>
      <WelcomeBar
        name={currentUser?.name ?? ''}
        roleText={roleText}
        period={periodQuery.data ?? null}
        loading={periodQuery.isLoading}
      />
      {cards.length === 0 ? (
        <Empty
          description="当前账号没有可用的工作台模块，请联系管理员配置角色"
          style={{ padding: '80px 0' }}
        />
      ) : (
        <Row gutter={[16, 16]}>
          {cards.map((item) => (
            <Col key={item.key} {...colProps}>
              {item.node}
            </Col>
          ))}
        </Row>
      )}
    </PageContainer>
  );
};

export default Workbench;
