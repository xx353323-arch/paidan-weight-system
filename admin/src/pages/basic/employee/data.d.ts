export type EmploymentStatus =
  | 'probation'
  | 'regular'
  | 'leaving'
  | 'left'
  | 'suspended';

export type EmployeeTagItem = {
  id: number;
  name: string;
  color: string;
};

export type EmployeeItem = {
  id: number;
  empNo: string;
  name: string;
  employmentStatus: EmploymentStatus;
  hiredAt?: string | null;
  leftAt?: string | null;
  inDispatchPool: boolean;
  remark?: string | null;
  leadUserId?: number | null;
  leadName?: string | null;
  tags: EmployeeTagItem[];
  username?: string | null;
};

export type EmployeeQueryParams = {
  current?: number;
  pageSize?: number;
  sorter?: string;
  keyword?: string;
  employmentStatus?: EmploymentStatus;
  tagIds?: string;
  leadUserId?: number;
};

export type EmployeeFormValues = {
  empNo: string;
  name: string;
  employmentStatus: EmploymentStatus;
  hiredAt?: string | null;
  remark?: string | null;
  leadUserId?: number | null;
  tagIds?: number[];
};

export type EmployeeStatusValues = {
  employmentStatus: EmploymentStatus;
  leftAt?: string | null;
};

export type EmployeeBatchTagValues = {
  employeeIds: number[];
  tagIds: number[];
  mode: 'append' | 'replace';
};

export type SelectOption = {
  label: string;
  value: number;
};

export type PageResult<T> = {
  success: boolean;
  data: T[];
  total: number;
  current: number;
  pageSize: number;
};

export type ApiResult<T> = {
  success: boolean;
  data: T;
  errorMessage?: string;
};
