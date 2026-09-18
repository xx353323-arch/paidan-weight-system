import { LogoutOutlined } from '@ant-design/icons';
import { history, useModel } from '@umijs/max';
import type { MenuProps } from 'antd';
import { Spin } from 'antd';
import React, { startTransition } from 'react';
import { clearToken, logout } from '@/services/paidan/auth';
import HeaderDropdown from '../HeaderDropdown';

type GlobalHeaderRightProps = {
  children?: React.ReactNode;
};

const menuItems: MenuProps['items'] = [
  {
    key: 'logout',
    icon: <LogoutOutlined />,
    label: '退出登录',
  },
];

const loginOut = async () => {
  try {
    await logout();
  } catch {
    return;
  } finally {
    clearToken();
    if (window.location.pathname !== '/user/login') {
      history.replace({ pathname: '/user/login' });
    }
  }
};

export const AvatarDropdown: React.FC<GlobalHeaderRightProps> = ({ children }) => {
  const { initialState, setInitialState } = useModel('@@initialState');

  const onMenuClick: MenuProps['onClick'] = (event) => {
    if (event.key === 'logout') {
      startTransition(() => {
        setInitialState((s) => ({ ...s, currentUser: undefined }));
      });
      loginOut();
    }
  };

  if (!initialState?.currentUser) {
    return <Spin size="small" />;
  }

  return (
    <HeaderDropdown
      placement="bottomRight"
      menu={{ selectedKeys: [], onClick: onMenuClick, items: menuItems }}
      arrow
    >
      {children}
    </HeaderDropdown>
  );
};
