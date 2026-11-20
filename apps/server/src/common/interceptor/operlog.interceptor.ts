import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';

import { OperlogConfig } from '../decorators/operlog.decorator';
import { OperlogService } from 'src/module/monitor/operlog/operlog.service';
import { BusinessException } from 'src/common/exceptions/business.exception';

@Injectable()
export class OperlogInterceptor implements NestInterceptor {
  private readonly reflector = new Reflector();
  private readonly logger = new Logger(OperlogInterceptor.name);

  constructor(readonly logService: OperlogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const { summary } = this.reflector.getAllAndOverride(`swagger/apiOperation`, [context.getHandler()]);
    const logConfig: OperlogConfig = this.reflector.get('operlog', context.getHandler());

    const handlerName = context.getHandler().name;

    const now = Date.now();

    return next
      .handle()
      .pipe(
        map((resultData) => {
          const costTime = Date.now() - now;
          if (resultData.code === 200) {
            this.safeLogAction({ costTime, resultData, handlerName, title: summary, businessType: logConfig?.businessType });
          } else {
            //业务错误
            this.safeLogAction({ costTime, errorMsg: resultData.msg, handlerName, title: summary, businessType: logConfig?.businessType });
          }
          return resultData;
        }),
      )
      .pipe(
        catchError((err) => {
          const costTime = Date.now() - now;
          this.safeLogAction({ costTime, errorMsg: this.extractErrorMsg(err), handlerName, title: summary, businessType: logConfig?.businessType });
          return throwError(() => err);
        }),
      );
  }

  /**
   * 从异常中提取可落库的错误信息字符串（兼容双协议）：
   * - BusinessException（throw 协议）：response 是 {code,msg,data} 对象，取 msg；
   * - 其余 HttpException（guard/ValidationPipe）：response.message（数组取首项，与 all-exceptions-filter 口径一致）；
   * 此前把 err.response 整个对象塞给 errorMsg（varchar），落库失败致操作日志丢失，现统一归一为字符串
   */
  private extractErrorMsg(err: any): string {
    if (err instanceof BusinessException) {
      return err.msg;
    }
    const response = err?.response;
    if (typeof response === 'string') {
      return response;
    }
    const message = response?.message ?? err?.message;
    return Array.isArray(message) ? message[0] : message;
  }

  /**
   * 日志录入为异步旁路：失败仅告警，不影响业务响应（防 unhandledRejection）
   */
  private safeLogAction(payload) {
    this.logService.logAction(payload).catch((error) => {
      this.logger.warn(`操作日志录入失败: ${error?.message ?? error}`);
    });
  }
}
