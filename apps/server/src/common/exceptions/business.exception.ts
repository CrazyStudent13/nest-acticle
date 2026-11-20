import { HttpException } from '@nestjs/common';
import { FORBIDDEN_CODE, NOT_FOUND_CODE, SERVER_ERROR_CODE, UNAUTHORIZED_CODE } from '@nest-acticle/shared';
import { BAD_REQUEST_CODE, TOO_MANY_REQUESTS_CODE } from 'src/common/constant/business.constant';

/** 命中白名单的业务码直接用作 HTTP 状态码，其余业务码统一归 HTTP 500 */
const HTTP_MAPPED_CODES = new Set<number>([
  BAD_REQUEST_CODE,
  UNAUTHORIZED_CODE,
  FORBIDDEN_CODE,
  NOT_FOUND_CODE,
  TOO_MANY_REQUESTS_CODE,
  SERVER_ERROR_CODE,
]);

/**
 * 业务异常：service 层以 throw 替代 ResultData.fail 的统一出口（错误协议迁移，见审查报告 Server P0-2）
 * - 信封与 ResultData.fail 完全同形 { code, msg, data }，对前端不可见差异；
 * - HTTP 状态码真实化：按业务码映射（400/401/403/404/429/500 直接用，其余归 500）；
 * - 信封由 AllExceptionsFilter 统一输出，service 不再自行构造响应体。
 * 事务内 throw 会正确回滚（TypeORM transaction 回调抛错即回滚并向上传递）。
 */
export class BusinessException extends HttpException {
  /** 业务码（写入信封 body.code，可与 HTTP 状态不同，如 601 → HTTP 500） */
  readonly code: number;

  readonly msg: string;

  readonly data: any;

  constructor(code: number, msg: string, data: any = null) {
    super({ code, msg, data }, HTTP_MAPPED_CODES.has(code) ? code : SERVER_ERROR_CODE);
    this.code = code;
    this.msg = msg;
    this.data = data;
  }
}
