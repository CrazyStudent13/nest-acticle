import { In, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { UserEntity } from 'src/module/system/user/entities/sys-user.entity';

/**
 * 公共查询层工具
 * 收口 service 层反复复制的查询模式：手写分页、LIKE 模糊拼接、逐行用户查询（N+1）、归属校验
 */

/**
 * 分页：pageNum 与 pageSize 同时存在时生效，缺任一则返回全量
 * 与既有 `if (query.pageSize && query.pageNum)` 手写语义保持一致（不补默认值）
 * @param qb 查询构建器（就地追加 skip/take，并原样返回以便链式调用）
 * @param query 携带 pageNum/pageSize 的查询参数
 */
export function paginate<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  query: { pageNum?: number; pageSize?: number },
): SelectQueryBuilder<T> {
  if (query.pageSize && query.pageNum) {
    qb.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
  }
  return qb;
}

/**
 * 模糊搜索：keyword 存在（真值）时追加 `${field} LIKE '%keyword%'` 条件，替代手写 LIKE 拼接
 * 绑定参数名由字段名派生（如 article.title → :article_title_kw），同一构建器多次调用互不覆盖
 * @param qb 查询构建器（就地追加 andWhere，并原样返回以便链式调用）
 * @param field 完整列引用，如 'article.title'
 * @param keyword 模糊关键字，为空时不追加任何条件
 */
export function applyLike<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  field: string,
  keyword?: string,
): SelectQueryBuilder<T> {
  if (keyword) {
    const paramName = `${field.replace(/[^a-zA-Z0-9]/g, '_')}_kw`;
    qb.andWhere(`${field} LIKE :${paramName}`, { [paramName]: `%${keyword}%` });
  }
  return qb;
}

/**
 * 批量回填用户公开信息：一次 IN 批查替代列表逐行 findOne（消 N+1）
 * 行为与既有逐行 findOne 完全一致：
 * - 行的 userId 为空值（0/null/undefined）或查不到对应用户（含已软删用户，此处本就不带 delFlag 过滤）时，目标字段回填 null；
 * - 查到时目标字段为仅含 select 声明字段的普通对象（与原对象字面量回填形状一致）。
 * @param list 带 userId 的行数组
 * @param userRepository 用户实体仓库
 * @param opts.select 批查用户时 select 的公开字段，默认 ['userId', 'nickName', 'avatar']
 * @param opts.field 用户信息回填到行上的目标字段名，默认 'userInfo'
 * @returns 新行数组（每行浅拷贝并追加目标字段），不修改入参行
 */
export async function attachUserInfo<T extends { userId?: number | null }>(
  list: T[],
  userRepository: Repository<UserEntity>,
  opts?: {
    select?: string[];
    field?: string;
  },
): Promise<Array<T & Record<string, any>>> {
  const selectFields = opts?.select ?? ['userId', 'nickName', 'avatar'];
  const targetField = opts?.field ?? 'userInfo';

  // 去重后批查；userId 假值直接排除（与原逐行 if (item.userId) 跳过逻辑一致）
  const userIds = [...new Set(list.map((item) => item.userId).filter(Boolean))];
  const userMap = new Map<number, Record<string, any>>();

  if (userIds.length > 0) {
    const users = await userRepository.find({
      where: { userId: In(userIds) },
      select: selectFields as any,
    });
    for (const user of users) {
      // 与原回填对象字面量一致：仅保留 select 声明的字段
      const info: Record<string, any> = {};
      for (const key of selectFields) {
        info[key] = user[key];
      }
      userMap.set(user.userId, info);
    }
  }

  return list.map((item) => ({
    ...item,
    [targetField]: userMap.get(item.userId) ?? null,
  }));
}

/**
 * 归属校验：管理员放行，否则仅资源本人放行
 * 判定与既有 `user.roles?.includes('admin')` + `entity.userId !== user.user.userId` 组合完全一致。
 * 返回是否放行（布尔值而非抛错），403 文案由调用方自行决定并 throw BusinessException（统一错误协议已全量迁移，
 * 由 AllExceptionsFilter 统一出 {code,msg,data} 信封）——各调用点文案不同（如"无权修改此文章"/"无权发布此文章"）
 * @param user 当前登录用户（UserDto 结构）
 * @param entity 携带创建者 userId 的资源行
 */
export function assertOwnership(
  user: { user?: { userId?: number }; roles?: string[] },
  entity: { userId?: number },
): boolean {
  if (user?.roles?.includes('admin')) {
    return true;
  }
  return entity.userId === user?.user?.userId;
}

/**
 * 服务层权限判断（与 PermissionGuard.hasPermission 同口径）：'*:*:*' 通配（超级管理员）或精确匹配。
 * 守卫只做端点准入；service 内的条件性放开（如文章状态编辑按权限串分支）用本函数复判——
 * 直接 `permissions.includes('xxx')` 会把 '*:*:*' 的超级管理员误判成无权限（2026-11-25 管理端恢复上架被 403 实测）
 * @param user 当前登录用户（UserDto 结构，permissions 为登录时快照）
 * @param permission 权限串
 */
export function hasPermission(user: { permissions?: string[] }, permission: string): boolean {
  const ALL_PERMISSION = '*:*:*';
  const permissions = user?.permissions || [];
  return permissions.includes(ALL_PERMISSION) || permissions.includes(permission);
}
