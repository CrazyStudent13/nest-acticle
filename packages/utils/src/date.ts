/**
 * 日期格式化工具（dayjs 封装）
 *
 * 收敛 client 各组件重复的「dayjs format + Invalid Date 回退空串」模式。
 * 注意：server 的 FormatDate/GetNowDate/FormatObjectDate 带独立的 dayjs 时区
 * 插件设置（Asia/Beijing），语义耦合 server 环境，保留在 server 本地不迁移。
 */
import dayjs from 'dayjs';

/** 默认完整时间格式 */
export const DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
/** 默认日期格式 */
export const DATE_FORMAT = 'YYYY-MM-DD';

/**
 * 当前时间的完整格式字符串（YYYY-MM-DD HH:mm:ss）
 */
export function nowDateTime(): string {
  return dayjs().format(DATETIME_FORMAT);
}

/**
 * 格式化为完整时间字符串；非法输入回退空串（与 client 既有展示行为一致）
 */
export function formatDateTime(value?: string | number | Date | null, format: string = DATETIME_FORMAT): string {
  if (value === null || typeof value === 'undefined' || value === '') {
    return '';
  }
  const formatted = dayjs(value).format(format);
  return formatted === 'Invalid Date' ? '' : formatted;
}

/**
 * 格式化为日期字符串（YYYY-MM-DD）；非法输入回退空串
 */
export function formatDate(value?: string | number | Date | null): string {
  return formatDateTime(value, DATE_FORMAT);
}

/**
 * 批量格式化对象中的时间字段（默认 createTime/updateTime），返回浅拷贝
 */
export function formatObjectDate<T extends Record<string, any>>(
  obj: T,
  fields: string[] = ['createTime', 'updateTime']
): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result: any = { ...obj };
  fields.forEach((field) => {
    if (result[field]) {
      result[field] = dayjs(result[field]).format(DATETIME_FORMAT);
    }
  });
  return result as T;
}
