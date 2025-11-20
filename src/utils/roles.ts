export type RoleName = 'user' | 'admin' | 'superadmin';

/**
 * Chuyển role dạng số → tên vai trò
 */
export function getRoleName(role: number): RoleName {
  if ([2, 99].includes(role)) return 'superadmin';
  if (role === 1) return 'admin';
  return 'user';
}
