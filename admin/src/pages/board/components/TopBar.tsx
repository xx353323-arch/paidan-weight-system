import { LogoutOutlined, TrophyFilled } from '@ant-design/icons';
import { history } from '@umijs/max';
import { Dropdown } from 'antd';
import React from 'react';
import { clearToken, logout } from '@/services/paidan/auth';
import { useBoardStyles } from '../styles';

type Props = {
  periodLabel: string;
  userName: string;
};

const TopBar: React.FC<Props> = ({ periodLabel, userName }) => {
  const { styles, cx } = useBoardStyles();

  const handleLogout = async () => {
    try {
      await logout();
    } catch {
      return;
    } finally {
      clearToken();
      history.replace('/user/login');
    }
  };

  return (
    <div
      className={cx(styles.topBar, styles.enter)}
      style={{ '--i': 0 } as React.CSSProperties}
    >
      <div className={styles.brand}>
        <TrophyFilled style={{ color: '#faad14', fontSize: 18 }} />
        <span className={styles.brandTitle}>派单权重榜</span>
        <span className={styles.brandPeriod}>{periodLabel}</span>
      </div>
      <Dropdown
        menu={{
          items: [
            { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
          ],
          onClick: ({ key }) => {
            if (key === 'logout') handleLogout();
          },
        }}
        placement="bottomRight"
      >
        <span style={{ cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}>
          {userName}
        </span>
      </Dropdown>
    </div>
  );
};

export default TopBar;
