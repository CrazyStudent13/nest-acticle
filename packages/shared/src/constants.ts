/**
 * 跨端共享的业务常量
 */

/**
 * 响应信封的业务码约定（HTTP 状态与业务码解耦，以 body.code 为准）
 * 契约来源：apps/server/src/common/utils/result.ts + all-exceptions-filter
 * 与 admin composables/useRequest.ts、client composables/api.ts 的分支处理保持同步
 */
export const SUCCESS_CODE = 200;

/** 未登录/登录过期（前端触发重新登录） */
export const UNAUTHORIZED_CODE = 401;

/** 无权限 */
export const FORBIDDEN_CODE = 403;

/** 资源不存在 */
export const NOT_FOUND_CODE = 404;

/** 服务器内部错误 */
export const SERVER_ERROR_CODE = 500;

/** RuoYi 约定：可向用户直接提示的非致命警告 */
export const WARNING_CODE = 601;

/**
 * 权限字面量（RuoYi 约定）
 * 契约来源：apps/server 侧权限校验与 apps/admin/src/utils/permission.ts 等
 */
/** 全权限通配符：拥有它即视为拥有任意权限 */
export const ALL_PERMISSION = '*:*:*';

/** 超级管理员角色 key：拥有它即视为拥有任意角色 */
export const SUPER_ADMIN_ROLE = 'admin';

/**
 * 字典类型字符串（sys_dict_type.dict_type 存值）
 * admin 字典组件 <dict-tag> 与未来 client 字典展示共用
 */
export const DICT_TYPE = {
  ARTICLE_PUBLISH_STATUS: 'post_article_publish_status',
  ARTICLE_AUDIT_STATUS: 'post_article_audit_status',
  ARTICLE_SOURCE: 'post_article_source',
  SUBJECT_PUBLISH_STATUS: 'post_subject_publish_status',
  SUBJECT_AUDIT_STATUS: 'post_subject_audit_status',
} as const;
