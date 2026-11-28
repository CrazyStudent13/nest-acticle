/**
 * 纯函数校验工具（正则版，零框架依赖）
 *
 * 来源：apps/client/utils/validate.ts（client 已删，全量迁入）+
 * apps/admin/src/composables/useValidator.ts 的正则等价函数。
 * admin 侧 zod 风格的 validURL/validEmail（语义更宽）已随死码删除；
 * 这里保留 RuoYi 传统正则实现作为唯一事实来源。
 */

/**
 * 判断 url 字符串中是否包含 http:// 或 https://
 */
export function isHttp(url: string | string[]): boolean {
  const str = Array.isArray(url) ? url.join('') : url;
  return str.indexOf('http://') !== -1 || str.indexOf('https://') !== -1;
}

/**
 * 判断 path 是否为外链（http/https/mailto/tel 协议开头）
 */
export function isExternal(path: string): boolean {
  return /^(https?:|mailto:|tel:)/.test(path);
}

/**
 * 判断是否为 URL 地址（RuoYi 传统严格正则，仅认可常见域名后缀）
 */
export function validURL(url: string): boolean {
  const reg =
    /^(https?|ftp):\/\/([a-zA-Z0-9.-]+(:[a-zA-Z0-9.&%$-]+)*@)*((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9][0-9]?)(\.(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])){3}|([a-zA-Z0-9-]+\.)*[a-zA-Z0-9-]+\.(com|edu|gov|int|mil|net|org|biz|arpa|info|name|pro|aero|coop|museum|[a-zA-Z]{2}))(:[0-9]+)*(\/($|[a-zA-Z0-9.,?'\\+&%$#=~_-]+))*$/;
  return reg.test(url);
}

/**
 * 判断是否为邮箱
 */
export function validEmail(email: string): boolean {
  const reg = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return reg.test(email);
}

/**
 * 类型守卫：判断是否为字符串
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string' || value instanceof String;
}

/**
 * 类型守卫：判断是否为数组
 */
export function isArray<T = any>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * 判断字符串是否全部由中文组成
 */
export function isChinese(str: string): boolean {
  return /^[\u4e00-\u9fa5]+$/.test(str);
}

/**
 * 判断字符串是否包含中文字符
 */
export function isHasChinese(str: string): boolean {
  return /[\u4e00-\u9fa5]/.test(str);
}

/**
 * 判断字符串是否完全由英文字母构成（等价于 validAlphabets）
 */
export function isEnglish(str: string): boolean {
  return /^[A-Za-z]+$/.test(str);
}

/**
 * 判断字符串是否只包含字母（大小写），isEnglish 的语义化别名
 */
export function validAlphabets(str: string): boolean {
  return /^[A-Za-z]+$/.test(str);
}

/**
 * 判断字符串是否全部为大写字母
 */
export function validUpperCase(str: string): boolean {
  return /^[A-Z]+$/.test(str);
}

/**
 * 判断字符串是否全部为小写字母
 */
export function validLowerCase(str: string): boolean {
  return /^[a-z]+$/.test(str);
}

/**
 * 判断字符串是否包含空格
 */
export function hasWhiteSpace(str: string): boolean {
  return /\s/.test(str);
}

/**
 * 判断字符串是否全部为字母/数字（仅允许输入字母、数字）
 */
export function isLegalChars(str: string): boolean {
  return /^[a-zA-Z0-9]+$/.test(str);
}

/**
 * 判断是否为合法数字（number 或纯数字字符串）
 */
export function isNumeric(value: string | number): boolean {
  if (typeof value === 'number') {
    return !isNaN(value) && isFinite(value);
  }
  if (typeof value === 'string') {
    const num = Number(value);
    return !isNaN(num) && isFinite(num);
  }
  return false;
}

/**
 * 判断是否为空值（null / undefined / 空字符串）
 */
export function isEmpty(val: unknown): boolean {
  return val === null || typeof val === 'undefined' || val === '';
}

/**
 * 邮箱格式（client 注册弹窗/改密表单等共用；此前 client 两处逐字双份靠注释同步）
 */
export const EMAIL_RE = /^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/;

/**
 * 密码字符种类判定：数字 / 字母 / 特殊字符
 * 口径单一事实来源：server IsPasswordComplexEnough 装饰器壳与 client 强度条均消费此处
 */
const PASSWORD_KIND_RES = [/\d/, /[a-zA-Z]/, /[^a-zA-Z0-9]/];

/**
 * 统计密码包含的字符种类数（0-3）
 */
export function countPasswordKinds(pwd: string): number {
  return PASSWORD_KIND_RES.filter((re) => re.test(pwd)).length;
}

/**
 * 复杂度是否达标：至少两类（中等强度起；登录不校验，老账号弱密码需可正常登录）
 */
export function isPasswordComplexEnough(pwd: string): boolean {
  return countPasswordKinds(pwd) >= 2;
}

/**
 * 密码强度等级：0 太短（<6 位）/ 1 弱（1 类）/ 2 中（2 类）/ 3 强（3 类，必含特殊字符）
 */
export function passwordStrength(pwd: string): number {
  return !pwd || pwd.length < 6 ? 0 : countPasswordKinds(pwd);
}
