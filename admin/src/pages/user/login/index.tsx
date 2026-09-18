import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { LoginForm, ProFormCheckbox, ProFormText } from '@ant-design/pro-components';
import { Helmet, history, useModel } from '@umijs/max';
import { Alert, App } from 'antd';
import { createStyles } from 'antd-style';
import React, { useState } from 'react';
import { Footer } from '@/components';
import { login, setToken } from '@/services/paidan/auth';
import Settings from '../../../../config/defaultSettings';

const getSafeRedirectUrl = (redirect: string | null): string => {
  if (!redirect?.startsWith('/')) return '/';
  if (redirect.startsWith('//')) return '/';
  try {
    const parsed = new URL(redirect, window.location.origin);
    if (parsed.origin !== window.location.origin) return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
};

const useStyles = createStyles(({ token }) => {
  return {
    container: {
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      overflow: 'auto',
      background: `linear-gradient(160deg, ${token.colorPrimaryBg} 0%, ${token.colorBgLayout} 60%)`,
    },
    tip: {
      marginTop: 16,
      padding: '12px 16px',
      borderRadius: token.borderRadius,
      background: token.colorFillQuaternary,
      color: token.colorTextSecondary,
      fontSize: 13,
      lineHeight: 1.9,
    },
  };
});

const Login: React.FC = () => {
  const [errorMessage, setErrorMessage] = useState<string>('');
  const { initialState, setInitialState } = useModel('@@initialState');
  const { styles } = useStyles();
  const { message } = App.useApp();

  const fetchUserInfo = async () => {
    const userInfo = await initialState?.fetchUserInfo?.();
    if (userInfo) {
      setInitialState((s) => ({ ...s, currentUser: userInfo }));
    }
    return userInfo;
  };

  const handleSubmit = async (values: PD.LoginParams) => {
    try {
      const res = await login({ ...values });
      if (res.success && res.data?.token) {
        setToken(res.data.token, res.data.refreshToken);
        const userInfo = await fetchUserInfo();
        if (!userInfo) {
          setErrorMessage('登录成功但无法获取账号信息，请联系管理员');
          return;
        }
        message.success('登录成功');
        const params = new URL(window.location.href).searchParams;
        const redirect = params.get('redirect');
        const roles = userInfo.roles ?? [];
        const onlyEmployee = roles.length > 0 && roles.every((r) => r === 'employee');
        window.location.href = redirect
          ? getSafeRedirectUrl(redirect)
          : onlyEmployee
            ? '/board'
            : '/workbench';
        return;
      }
      setErrorMessage(res.errorMessage || '用户名或密码错误');
    } catch (error: any) {
      setErrorMessage(error?.info?.errorMessage || '登录失败，请确认后端服务已启动');
    }
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>登录 - {Settings.title}</title>
      </Helmet>
      <div style={{ flex: '1', padding: '32px 0' }}>
        <LoginForm
          contentStyle={{ minWidth: 280, maxWidth: '75vw' }}
          logo={null}
          title="派单权重评价系统"
          subTitle="每月一次的编辑评价与派单权重计算"
          initialValues={{ autoLogin: true }}
          onFinish={async (values) => {
            await handleSubmit(values as PD.LoginParams);
          }}
        >
          {errorMessage && (
            <Alert style={{ marginBottom: 24 }} title={errorMessage} type="error" showIcon />
          )}
          <ProFormText
            name="username"
            fieldProps={{ size: 'large', prefix: <UserOutlined /> }}
            placeholder="请输入账号"
            rules={[{ required: true, message: '请输入账号' }]}
          />
          <ProFormText.Password
            name="password"
            fieldProps={{ size: 'large', prefix: <LockOutlined /> }}
            placeholder="请输入密码"
            rules={[{ required: true, message: '请输入密码' }]}
          />
          <div style={{ marginBottom: 24 }}>
            <ProFormCheckbox noStyle name="autoLogin">
              保持登录状态
            </ProFormCheckbox>
          </div>
          <div className={styles.tip}>
            管理员 admin，编辑主管 editor1 与 editor2，交付 delivery1 至 delivery3，客服 cs1，人事 hr1。初始密码统一为 123456。
          </div>
        </LoginForm>
      </div>
      <Footer />
    </div>
  );
};

export default Login;
