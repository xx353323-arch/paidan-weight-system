import { describe, expect, it } from 'vitest';
import access from './access';

const build = (roles: PD.RoleCode[]): { currentUser: PD.CurrentUser } => ({
  currentUser: {
    userid: '1',
    name: '测试用户',
    username: 'tester',
    access: roles[0] ?? 'viewer',
    roles,
    raterRoles: roles.filter((r) => r !== 'admin'),
    coverageModes: {},
    mustChangePassword: false,
  },
});

describe('access', () => {
  it('管理员拥有全部权限', () => {
    const result = access(build(['admin']));
    expect(result.canAdmin).toBe(true);
    expect(result.canManageCycle).toBe(true);
    expect(result.canAdjustWeight).toBe(true);
    expect(result.canViewDispatch).toBe(true);
  });

  it('编辑主管可以打分但不能管理', () => {
    const result = access(build(['editor_lead']));
    expect(result.canAdmin).toBe(false);
    expect(result.canEvaluate).toBe(true);
    expect(result.canManageCycle).toBe(false);
  });

  it('交付可以看派单参考也可以打分', () => {
    const result = access(build(['delivery']));
    expect(result.canViewDispatch).toBe(true);
    expect(result.canEvaluate).toBe(true);
    expect(result.canAdmin).toBe(false);
  });

  it('兼任管理员的编辑主管两边权限都有', () => {
    const result = access(build(['admin', 'editor_lead']));
    expect(result.canAdmin).toBe(true);
    expect(result.canEvaluate).toBe(true);
  });

  it('未登录时全部为假', () => {
    const result = access(undefined);
    expect(result.canAdmin).toBe(false);
    expect(result.canEvaluate).toBe(false);
    expect(result.canViewDispatch).toBe(false);
  });
});
