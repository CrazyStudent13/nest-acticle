import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

// 密码字符种类：数字 / 字母 / 特殊字符（与前台 apps/client/utils/password.ts 口径一致）
const KIND_RES = [/\d/, /[a-zA-Z]/, /[^a-zA-Z0-9]/];

// 统计密码包含的字符种类数（0-3）
export const countPasswordKinds = (pwd: string) => KIND_RES.filter((re) => re.test(pwd)).length;

// 复杂度是否达标：至少两类（中等强度起）
export const isPasswordComplexEnough = (pwd: string) => countPasswordKinds(pwd) >= 2;

/**
 * 密码复杂度校验装饰器：至少包含数字、字母、特殊字符中的两类
 * 仅用于注册/改密等"设置密码"入口；登录 DTO 不得使用，老账号弱密码需可正常登录
 */
export function IsPasswordComplexEnough(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isPasswordComplexEnough',
      validator: {
        validate: (value) => typeof value === 'string' && isPasswordComplexEnough(value),
        defaultMessage: buildMessage(() => '密码需包含数字、字母、特殊字符中的至少两类', validationOptions),
      },
    },
    validationOptions,
  );
}
