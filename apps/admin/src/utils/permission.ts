import useUserStore from '@/store/modules/user';
import { ALL_PERMISSION, SUPER_ADMIN_ROLE } from '@nest-acticle/shared';

/**
 * 字符权限校验
 * @param value 校验值
 * @returns 是否有权限
 */
export function checkPermi(value: string[]): boolean {
  if (value && value instanceof Array && value.length > 0) {
    const permissions = useUserStore().permissions;

    const hasPermission = permissions.some((permission) => {
      return ALL_PERMISSION === permission || value.includes(permission);
    });

    return hasPermission;
  } else {
    console.error(`need roles! Like checkPermi="['system:user:add','system:user:edit']"`);
    return false;
  }
}

/**
 * 角色权限校验
 * @param value 校验值
 * @returns 是否有角色
 */
export function checkRole(value: string[]): boolean {
  if (value && value instanceof Array && value.length > 0) {
    const roles = useUserStore().roles;

    const hasRole = roles.some((role) => {
      return SUPER_ADMIN_ROLE === role || value.includes(role);
    });

    return hasRole;
  } else {
    console.error(`need roles! Like checkRole="['admin','editor']"`);
    return false;
  }
}
