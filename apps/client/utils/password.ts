// 密码强度与复杂度：按字符种类数定级（数字 / 字母 / 特殊字符）
// 1 类 = 弱，2 类 = 中，3 类（必含特殊字符）= 强；长度不足 6 位视为太短
// 供注册弹窗（components/Auth/Modal.vue）与个人中心改密表单（pages/user/settings.vue）共用

const KIND_RES = [/\d/, /[a-zA-Z]/, /[^a-zA-Z0-9]/]

// 统计密码包含的字符种类数（0-3）
export const countPasswordKinds = (pwd: string) => KIND_RES.filter((re) => re.test(pwd)).length

// 复杂度是否达标：至少两类（中等强度起）
export const isPasswordComplexEnough = (pwd: string) => countPasswordKinds(pwd) >= 2

// 强度等级：0 太短（<6 位）/ 1 弱 / 2 中 / 3 强
export const passwordStrength = (pwd: string) => (!pwd || pwd.length < 6 ? 0 : countPasswordKinds(pwd))

// 展示用提示文案
export const PASSWORD_HINT = '6-20 位，需包含数字、字母、特殊字符中的至少两类'
