import type { EmploymentStatus } from './data.d';

export const EMPLOYMENT_STATUS_VALUE_ENUM: Record<
  EmploymentStatus,
  { text: string; status: string }
> = {
  probation: { text: '试用', status: 'Warning' },
  regular: { text: '在职', status: 'Success' },
  leaving: { text: '离职中', status: 'Processing' },
  left: { text: '已离职', status: 'Default' },
  suspended: { text: '停职', status: 'Error' },
};

export const EMPLOYMENT_STATUS_OPTIONS = (
  Object.keys(EMPLOYMENT_STATUS_VALUE_ENUM) as EmploymentStatus[]
).map((value) => ({
  value,
  label: EMPLOYMENT_STATUS_VALUE_ENUM[value].text,
}));

export const EMPLOYEE_QUERY_KEY = 'basic-employee';
