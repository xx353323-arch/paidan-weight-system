import { PageContainer, ProCard } from '@ant-design/pro-components';
import { useState } from 'react';
import MatrixOverview from './components/MatrixOverview';
import RaterTargets from './components/RaterTargets';

const RelationManage = () => {
  const [tab, setTab] = useState('rater');

  return (
    <PageContainer
      title="评价关系"
      content="维护谁评价谁，以及交付各自的对接名单。人事与客服按全员自动展开，编辑主管一人一管，交付对接按名单勾选。"
    >
      <ProCard
        tabs={{
          activeKey: tab,
          onChange: setTab,
          items: [
            { key: 'rater', label: '按评价人配置', children: <RaterTargets /> },
            { key: 'matrix', label: '关系总览', children: <MatrixOverview /> },
          ],
        }}
      />
    </PageContainer>
  );
};

export default RelationManage;
