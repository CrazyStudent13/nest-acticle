import type { SortRule } from '../enums';

/**
 * 统一响应信封
 * 契约来源：apps/server/src/common/utils/result.ts（ResultData { code, msg, data }）
 */
export interface ApiResponse<T = unknown> {
  /** 业务码，200 为成功，见 constants.ts 中的各业务码 */
  code: number;
  msg: string;
  /** 成功时为载荷；失败时 server 置 null（ResultData.data 声明为可选，调用方应在 code 判断通过后再取用） */
  data?: T;
}

/**
 * 列表分页数据：server 所有列表端点统一返回 { list, total }
 */
export interface PageResult<T = unknown> {
  list: T[];
  total: number;
}

/**
 * 基础分页查询参数（对应 server common/dto PagingDto 的 pageNum/pageSize）
 */
export interface PageQuery {
  pageNum?: number;
  pageSize?: number;
}

/**
 * 完整分页查询参数（对应 server PagingDto 全量字段）
 */
export interface PagingParams extends PageQuery {
  /** 时间区间过滤，RuoYi 约定挂在 params.beginTime/endTime */
  params?: {
    beginTime?: string;
    endTime?: string;
  };
  /** 排序字段名（实体属性名） */
  orderByColumn?: string;
  /** 排序方向 */
  isAsc?: SortRule;
}
