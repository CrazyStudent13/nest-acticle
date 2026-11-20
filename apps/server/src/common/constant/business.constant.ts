/**
 * 业务码常量（信封 body.code 取值）
 * 契约来源：packages/shared/src/constants.ts（200/401/403/404/500/601 已收口在 shared），
 * 此处仅补充 shared 暂缺、业务异常需映射 HTTP 状态时用到的两个码
 */

/** 参数错误 */
export const BAD_REQUEST_CODE = 400;

/** 请求过于频繁（限流） */
export const TOO_MANY_REQUESTS_CODE = 429;

export class BusinessType {
  /**
   * 其它
   */
  public static readonly OTHER = 0;

  /**
   * 新增
   */
  public static readonly INSERT = 1;

  /**
   * 修改
   */
  public static readonly UPDATE = 2;

  /**
   * 删除
   */
  public static readonly DELETE = 3;

  /**
   * 授权
   */
  public static readonly GRANT = 4;

  /**
   * 导出
   */
  public static readonly EXPORT = 5;

  /**
   * 导入
   */
  public static readonly IMPORT = 6;

  /**
   * 强退
   */
  public static readonly FORCE = 7;

  /**
   * 生成代码
   */
  public static readonly GENCODE = 8;

  /**
   * 清空数据
   */
  public static readonly CLEAN = 9;
}
