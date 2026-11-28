import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

import { isPasswordComplexEnough } from '@nest-acticle/utils';

// 纯函数口径（KIND_RES/countPasswordKinds/isPasswordComplexEnough）单一事实来源在
// @nest-acticle/utils/validate，与前台 client 强度条同源消费；server 侧只保留
// class-validator 装饰器壳——装饰器依赖 reflect-metadata/class-validator，不进共享包

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
