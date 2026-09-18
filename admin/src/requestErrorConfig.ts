import type { RequestOptions } from '@@/plugin-request/request';
import type { RequestConfig } from '@umijs/max';
import { message, notification } from 'antd';
import { clearToken, getToken } from '@/services/paidan/auth';

enum ErrorShowType {
  SILENT = 0,
  WARN_MESSAGE = 1,
  ERROR_MESSAGE = 2,
  NOTIFICATION = 3,
  REDIRECT = 9,
}

interface ResponseStructure {
  success: boolean;
  data: unknown;
  errorCode?: number;
  errorMessage?: string;
  showType?: ErrorShowType;
}

const loginPath = '/user/login';

function redirectToLogin() {
  clearToken();
  if (window.location.pathname !== loginPath) {
    const redirect = encodeURIComponent(
      window.location.pathname + window.location.search + window.location.hash,
    );
    window.location.href = `${loginPath}?redirect=${redirect}`;
  }
}

export const errorConfig: RequestConfig = {
  errorConfig: {
    errorThrower: (res) => {
      const { success, data, errorCode, errorMessage, showType } =
        res as unknown as ResponseStructure;
      if (!success) {
        const error: any = new Error(errorMessage);
        error.name = 'BizError';
        error.info = { errorCode, errorMessage, showType, data };
        throw error;
      }
    },
    errorHandler: (error: any, opts: any) => {
      if (opts?.skipErrorHandler) throw error;
      if (error.name === 'BizError') {
        const errorInfo: ResponseStructure | undefined = error.info;
        if (errorInfo) {
          const { errorMessage, errorCode } = errorInfo;
          switch (errorInfo.showType) {
            case ErrorShowType.SILENT:
              break;
            case ErrorShowType.WARN_MESSAGE:
              message.warning(errorMessage);
              break;
            case ErrorShowType.ERROR_MESSAGE:
              message.error(errorMessage);
              break;
            case ErrorShowType.NOTIFICATION:
              notification.open({
                title: String(errorCode ?? '提示'),
                description: errorMessage,
              });
              break;
            case ErrorShowType.REDIRECT:
              message.error(errorMessage || '登录状态已失效，请重新登录');
              redirectToLogin();
              break;
            default:
              message.error(errorMessage);
          }
        }
      } else if (error.response) {
        const status = error.response.status;
        if (status === 401) {
          redirectToLogin();
        } else if (status === 403) {
          message.error('没有权限执行此操作');
        } else {
          message.error(`请求失败，状态码 ${status}`);
        }
      } else if (typeof navigator !== 'undefined' && !navigator.onLine) {
        message.error('网络不可用，请检查网络连接后重试');
      } else if (error.request) {
        message.error('服务器无响应，请确认后端服务已启动');
      } else {
        message.error('请求发生错误，请重试');
      }
    },
  },

  requestInterceptors: [
    (config: RequestOptions) => {
      const token = getToken();
      if (token) {
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
      }
      return config;
    },
  ],

  responseInterceptors: [
    (response: any) => {
      const body = response?.data as ResponseStructure | undefined;
      if (body && body.success === false && body.showType === ErrorShowType.REDIRECT) {
        redirectToLogin();
      }
      return response;
    },
  ],
};
