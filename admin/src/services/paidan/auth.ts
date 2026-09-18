import { request } from '@umijs/max';

export const TOKEN_KEY = 'paidan_token';
export const REFRESH_KEY = 'paidan_refresh_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setToken(token: string, refreshToken?: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  } catch {
    return;
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    return;
  }
}

export async function login(body: PD.LoginParams) {
  return request<PD.Response<PD.LoginResult>>('/api/auth/login', {
    method: 'POST',
    data: body,
    skipErrorHandler: true,
  });
}

export async function currentUser(options?: Record<string, any>) {
  return request<PD.Response<PD.CurrentUser>>('/api/auth/currentUser', {
    method: 'GET',
    ...(options || {}),
  });
}

export async function logout() {
  const refreshToken = localStorage.getItem(REFRESH_KEY) || '';
  return request<PD.Response<boolean>>('/api/auth/logout', {
    method: 'POST',
    data: { refreshToken },
    skipErrorHandler: true,
  });
}

export async function changePassword(body: { oldPassword: string; newPassword: string }) {
  return request<PD.Response<boolean>>('/api/auth/password', {
    method: 'POST',
    data: body,
  });
}
