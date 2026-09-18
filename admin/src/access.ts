export default function access(initialState: { currentUser?: PD.CurrentUser } | undefined) {
  const currentUser = initialState?.currentUser;
  const roles = currentUser?.roles ?? [];
  const has = (code: PD.RoleCode) => roles.includes(code);
  const isAdmin = has('admin');
  const isRater = has('editor_lead') || has('delivery') || has('cs') || has('hr');

  return {
    canAdmin: isAdmin,
    canEvaluate: isRater,
    canViewDispatch: isAdmin || isRater,
    canManageCycle: isAdmin,
    canAdjustWeight: isAdmin,
  };
}
