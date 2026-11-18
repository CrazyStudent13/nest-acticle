/**
 * admin 校验工具
 *
 * 纯正则校验函数已收敛到 @nest-acticle/utils，这里 re-export 维持既有导入路径
 * （isExternal/isHttp 由 composables 目录 auto-import 注入使用）。
 * 原 zod 校验器（urlSchema/validURL/validEmail 等）经排查零消费者，已删除，
 * zod 依赖一并移除；isValidBlob 为文件下载流程专用，保留本地。
 */
export { isExternal, isHttp } from '@nest-acticle/utils';

/**
 * 验证 Blob 是否为有效的文件流（非 JSON 错误响应）
 * 用于文件下载场景，判断后端返回的是文件还是错误信息
 * @param blob - Blob 对象
 * @returns 如果 type 不是 application/json 则返回 true（表示是有效文件）
 */
export function isValidBlob(blob: Blob): boolean {
  return blob.type !== 'application/json';
}
