import type { Settings as LayoutSettings } from '@ant-design/pro-components';
import type { RequestConfig, RunTimeLayoutConfig } from '@umijs/max';
import { history, Link } from '@umijs/max';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import React from 'react';

dayjs.extend(relativeTime);

import { AvatarDropdown, ErrorBoundary, Footer, OfflineBanner } from '@/components';
import { currentUser as queryCurrentUser, getToken } from '@/services/paidan/auth';
import defaultSettings from '../config/defaultSettings';
import { errorConfig } from './requestErrorConfig';

const isDev = process.env.NODE_ENV === 'development';
const loginPath = '/user/login';
const changePasswordPath = '/user/change-password';
const publicPaths: string[] = [];
const whiteList = [loginPath, changePasswordPath, ...publicPaths];

export async function getInitialState(): Promise<{
  settings?: Partial<LayoutSettings>;
  currentUser?: PD.CurrentUser;
  loading?: boolean;
  fetchUserInfo?: () => Promise<PD.CurrentUser | undefined>;
  settingDrawerOpen?: boolean;
}> {
  const fetchUserInfo = async () => {
    if (!getToken()) return undefined;
    try {
      const msg = await queryCurrentUser({ skipErrorHandler: true });
      return msg.data;
    } catch (_error) {
      const { pathname, search, hash } = history.location;
      history.replace(`${loginPath}?redirect=${encodeURIComponent(pathname + search + hash)}`);
    }
    return undefined;
  };

  const { location } = history;
  if (!whiteList.includes(location.pathname)) {
    const currentUser = await fetchUserInfo();
    return {
      fetchUserInfo,
      currentUser,
      settings: defaultSettings as Partial<LayoutSettings>,
      settingDrawerOpen: false,
    };
  }
  return {
    fetchUserInfo,
    settings: defaultSettings as Partial<LayoutSettings>,
    settingDrawerOpen: false,
  };
}

export const layout: RunTimeLayoutConfig = ({ initialState }) => {
  return {
    menuItemRender: (item, dom) => {
      if (item.path) {
        return (
          <Link to={item.path} prefetch>
            {dom}
          </Link>
        );
      }
      return dom;
    },
    actionsRender: () => [],
    avatarProps: {
      title: initialState?.currentUser?.name || '未登录',
      render: (_, avatarChildren) => <AvatarDropdown>{avatarChildren}</AvatarDropdown>,
    },
    waterMarkProps: {
      content: initialState?.currentUser?.name,
    },
    footerRender: () => <Footer />,
    onPageChange: () => {
      const { location } = history;
      if (publicPaths.includes(location.pathname)) {
        return;
      }
      if (!initialState?.currentUser && location.pathname !== loginPath) {
        history.replace(
          `${loginPath}?redirect=${encodeURIComponent(location.pathname + location.search + location.hash)}`,
        );
        return;
      }
      if (
        initialState?.currentUser?.mustChangePassword &&
        location.pathname !== changePasswordPath
      ) {
        history.replace(changePasswordPath);
      }
    },
    bgLayoutImgList: [],
    links: [],
    ErrorBoundary,
    menuHeaderRender: undefined,
    ...initialState?.settings,
  };
};

export const request: RequestConfig = {
  baseURL: isDev ? '' : (process.env.UMI_APP_API_BASE as string) || '',
  ...errorConfig,
};

export function rootContainer(container: React.ReactNode) {
  return (
    <>
      <OfflineBanner />
      <ErrorBoundary>{container}</ErrorBoundary>
    </>
  );
}
