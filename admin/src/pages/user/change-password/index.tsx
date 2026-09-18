import { LockOutlined } from '@ant-design/icons';
import { ProForm, ProFormText } from '@ant-design/pro-components';
import { Helmet, history, useModel } from '@umijs/max';
import { Alert, App, Card } from 'antd';
import { createStyles } from 'antd-style';
import React from 'react';
import { changePassword, clearToken } from '@/services/paidan/auth';
import Settings from '../../../../config/defaultSettings';

const useStyles = createStyles(({ token }) => ({
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    padding: 24,
    background: `linear-gradient(160deg, ${token.colorPrimaryBg} 0%, ${token.colorBgLayout} 60%)`,
  },
  card: {
    width: 420,
    maxWidth: '100%',
  },
}));

const ChangePassword: React.FC = () => {
  const { styles } = useStyles();
  const { initialState, setInitialState } = useModel('@@initialState');
  const { message } = App.useApp();
  const currentUser = initialState?.currentUser;

  const handleSubmit = async (values: Record<string, string>) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的新密码不一致');
      return false;
    }
    if (currentUser && values.newPassword === currentUser.username) {
      message.error('新密码不能与账号相同');
      return false;
    }
    try {
      await changePassword({ oldPassword: values.oldPassword, newPassword: values.newPassword });
      message.success('密码修改成功，请用新密码重新登录');
      clearToken();
      setInitialState((s) => ({ ...s, currentUser: undefined }));
      history.replace('/user/login');
      return true;
    } catch (error: any) {
      message.error(error?.info?.errorMessage || '修改失败，请重试');
      return false;
    }
  };

  return (
    <div className={styles.container}>
      <Helmet>
        <title>修改密码 - {Settings.title}</title>
      </Helmet>
      <Card className={styles.card} title="首次登录请修改密码">
        <Alert
          style={{ marginBottom: 20 }}
          type="warning"
          showIcon
          title={`${currentUser?.name || ''} 当前使用的是初始密码，修改后才能使用系统`}
        />
        <ProForm
          submitter={{
            searchConfig: { submitText: '确认修改' },
            resetButtonProps: false,
            submitButtonProps: { size: 'large', style: { width: '100%' } },
          }}
          onFinish={handleSubmit}
        >
          <ProFormText.Password
            name="oldPassword"
            label="当前密码"
            fieldProps={{ size: 'large', prefix: <LockOutlined /> }}
            placeholder="初始密码与账号相同"
            rules={[{ required: true, message: '请输入当前密码' }]}
          />
          <ProFormText.Password
            name="newPassword"
            label="新密码"
            fieldProps={{ size: 'large', prefix: <LockOutlined /> }}
            placeholder="至少6位，不能与账号相同"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 6, message: '密码至少6位' },
            ]}
          />
          <ProFormText.Password
            name="confirmPassword"
            label="确认新密码"
            fieldProps={{ size: 'large', prefix: <LockOutlined /> }}
            placeholder="再次输入新密码"
            rules={[{ required: true, message: '请再次输入新密码' }]}
          />
        </ProForm>
      </Card>
    </div>
  );
};

export default ChangePassword;
