import { ApiProperty } from '@nestjs/swagger';
import { SUCCESS_CODE } from '@nest-acticle/shared';

// 业务码取值收敛到共享契约包（200/401/403/404/500/601），这里保持原导出名不变
export { SUCCESS_CODE };

/**
 * 响应结构
 * ok 成功
 * fail 失败
 */
export class ResultData {
  constructor(code = SUCCESS_CODE, msg?: string, data?: any) {
    this.code = code;
    this.msg = msg || '操作成功';
    this.data = data || null;
  }

  @ApiProperty({ type: 'number', default: SUCCESS_CODE })
  code: number;

  @ApiProperty({ type: 'string', default: '操作成功' })
  msg?: string;

  data?: any;

  static ok(data?: any, msg?: string): ResultData {
    return new ResultData(SUCCESS_CODE, msg, data);
  }

  static fail(code: number, msg?: string, data?: any): ResultData {
    return new ResultData(code || 500, msg || 'fail', data);
  }
}
