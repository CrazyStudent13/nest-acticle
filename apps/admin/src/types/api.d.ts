/**
 * admin 通用 API 类型
 *
 * 契约类型（响应信封/分页/文章/专栏/状态枚举等）已收敛到 @nest-acticle/shared，
 * 这里统一转发，既有 `from '@/types/api'` 的导入无需改动；
 * 仅 admin 专属的类型仍在本文件维护。
 */
export * from '@nest-acticle/shared';

/** 审核参数：server AuditPostArticleDto 在 admin 侧的历史命名 */
export type { ArticleAuditParams as AuditParams } from '@nest-acticle/shared';

/**
 * 用户权限信息（/getInfo 返回）
 */
export interface UserAuthInfo {
  permissions: string[]; // 权限列表
  roles: string[]; // 角色列表
}

/**
 * 权限验证结果
 */
export interface AuthValidationResult {
  hasPermission: boolean; // 是否具有权限
  hasRole: boolean; // 是否具有角色
}
