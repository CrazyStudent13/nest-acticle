/**
 * 查询字符串序列化
 *
 * 来源：apps/admin/src/composables/useRequest.ts 的 paramsToQueryString（admin 改为从本包导入）。
 * 嵌套对象/数组序列化为 a[b][c]=v 括号记法；null/空串跳过；Date/RegExp 原样 String()。
 */

/**
 * 将任意嵌套参数对象序列化为 URL 查询串（不含前导 ?）
 */
export function serializeQuery(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();

  // 递归处理嵌套结构
  const serialize = (obj: any, prefix = ''): void => {
    if (obj == null || obj === '') return;

    if (Array.isArray(obj)) {
      obj.forEach((item, i) => serialize(item, `${prefix}[${i}]`));
    } else if (typeof obj === 'object' && !(obj instanceof Date) && !(obj instanceof RegExp)) {
      Object.entries(obj).forEach(([key, val]) => serialize(val, prefix ? `${prefix}[${key}]` : key));
    } else {
      searchParams.append(prefix, String(obj));
    }
  };

  Object.entries(params).forEach(([key, value]) => serialize(value, key));
  return searchParams.toString();
}
