/**
 * 通用树构建工具
 *
 * 来源：apps/admin/src/composables/useCommon.ts 的 handleTree（admin 保留同名包装）。
 * 注意：server 的 ListToTree 是「输出新 {id,label,children} 节点」的映射语义，
 * 与本函数「原对象挂 children」的语义不同，故 server 侧保留原实现不迁移。
 */

export interface BuildTreeOptions {
  /** 节点 id 字段名，默认 'id' */
  idKey?: string;
  /** 父节点 id 字段名，默认 'parentId' */
  parentKey?: string;
  /** 子节点列表字段名，默认 'children' */
  childrenKey?: string;
}

/**
 * 一维数组转树结构：父节点 id 不在集合中的项作为根，子节点按 parentKey 聚挂到 children
 * @param data 扁平列表
 * @param options 字段名配置
 */
export function buildTree<T extends Record<string, any>>(data: T[], options: BuildTreeOptions = {}): T[] {
  if (!Array.isArray(data)) {
    return [];
  }

  const idKey = options.idKey || 'id';
  const parentKey = options.parentKey || 'parentId';
  const childrenKey = options.childrenKey || 'children';

  const childrenMap = new Map<string | number, T[]>();
  const nodeMap = new Map<string | number, T>();
  const result: T[] = [];

  // 1. 建立映射关系
  for (const item of data) {
    const pid = item[parentKey];
    const idVal = item[idKey];

    if (!childrenMap.has(pid)) childrenMap.set(pid, []);
    childrenMap.get(pid)!.push(item);
    nodeMap.set(idVal, item);
  }

  // 2. 组装树结构：父节点不存在的作为根；存在则挂到父节点的 children
  for (const item of data) {
    const pid = item[parentKey];
    if (!nodeMap.has(pid)) {
      result.push(item);
    }
    const children = childrenMap.get(item[idKey]);
    if (children) {
      (item as any)[childrenKey] = children;
    }
  }

  return result;
}
