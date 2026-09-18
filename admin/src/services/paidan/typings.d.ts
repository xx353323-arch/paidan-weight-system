declare namespace PD {
  type RoleCode = 'admin' | 'editor_lead' | 'delivery' | 'cs' | 'hr';

  type CurrentUser = {
    userid: string;
    name: string;
    username: string;
    access: string;
    roles: RoleCode[];
    raterRoles: RoleCode[];
    coverageModes: Record<string, string>;
    mustChangePassword: boolean;
  };

  type LoginParams = {
    username: string;
    password: string;
    autoLogin?: boolean;
  };

  type LoginResult = {
    token: string;
    refreshToken: string;
    expiresIn: number;
    mustChangePassword: boolean;
  };

  type Response<T> = {
    success: boolean;
    data: T;
    errorCode?: number;
    errorMessage?: string;
    showType?: number;
  };

  type PageResponse<T> = {
    success: boolean;
    data: T[];
    total: number;
    current: number;
    pageSize: number;
  };

  type Tag = {
    id: number;
    name: string;
    color: string;
    sortOrder: number;
    isActive: boolean;
    employeeCount?: number;
  };

  type Employee = {
    id: number;
    empNo: string;
    name: string;
    employmentStatus: string;
    hiredAt?: string;
    leftAt?: string;
    inDispatchPool: boolean;
    remark?: string;
    leadUserId?: number;
    leadName?: string;
    tags: EmployeeTagRef[];
  };

  type EmployeeTagRef = {
    id: number;
    name: string;
    color: string;
  };
}
