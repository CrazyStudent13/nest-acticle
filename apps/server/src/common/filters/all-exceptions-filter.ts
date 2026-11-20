import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { BusinessException } from 'src/common/exceptions/business.exception';

/**
 * 全局异常过滤器
 * - BusinessException：业务异常统一出口，HTTP 状态按业务码映射（400/401/403/404/429/500 直接用，其余归 500），信封 body.code 携带业务码
 * - 其他 HttpException：透传真实 HTTP 状态码（400/401/403/429...），错误信息放入统一响应信封
 * - 非 HttpException（未处理异常）：HTTP 500，并记录完整堆栈便于排障
 * 响应体统一为 { code, msg, data } 信封（与 ResultData.fail 同形），前端据此处理
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // 业务异常：信封 code 携带业务码（可与 HTTP 状态不同，如 601 → HTTP 500），data 透传业务附带值
    if (exception instanceof BusinessException) {
      const status = exception.getStatus();
      this.logger.warn(`${request.method} ${request.url} -> ${status} ${exception.code} ${exception.msg}`);
      response.status(status).json({
        code: exception.code,
        msg: exception.msg,
        data: exception.data,
      });
      return;
    }

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    let message = '系统内部错误';
    if (isHttpException) {
      const exceptionResponse = exception.getResponse() as Record<string, any>;
      message = exceptionResponse?.message ?? 'Service Error';
      if (Array.isArray(message)) {
        message = message[0];
      }
      this.logger.warn(`${request.method} ${request.url} -> ${status} ${message}`);
    } else {
      this.logger.error(
        `${request.method} ${request.url} -> 500 ${exception?.message}`,
        exception?.stack,
      );
    }

    response.status(status).json({
      code: status,
      msg: message,
      data: null,
    });
  }
}
