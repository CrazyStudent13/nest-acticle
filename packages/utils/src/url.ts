/**
 * 文件/静态资源 URL 拼接
 *
 * 来源：apps/admin/src/utils/image.ts 的 isExternalUrl +
 * apps/client/utils/cover.ts 的 toCoverUrl 核心。
 * 环境相关逻辑（Vite env、apiBase 注入）留在各应用侧，这里只提供纯拼接。
 */

/**
 * 判断是否为外部 URL（http:// 或 https:// 开头）
 */
export function isExternalUrl(url: string): boolean {
  if (!url) return false;
  return /^https?:\/\//.test(url);
}

/**
 * 将相对上传路径拼上服务地址；已是绝对地址（http/https）原样返回，空值返回空串
 */
export function joinFileUrl(apiBase: string, path?: string | null): string {
  if (!path) {
    return '';
  }
  return isExternalUrl(path) ? path : `${apiBase}${path}`;
}
