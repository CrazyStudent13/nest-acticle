// 密码强度与复杂度：口径单一事实来源收口到 @nest-acticle/utils（server IsPasswordComplexEnough
// 装饰器壳同源消费），这里 re-export 维持既有导入路径；展示文案 PASSWORD_HINT 属 UI 层保留本地
// 供注册弹窗（components/Auth/Modal.vue）与个人中心改密表单（pages/user/settings.vue）共用
export { countPasswordKinds, isPasswordComplexEnough, passwordStrength } from '@nest-acticle/utils'

// 展示用提示文案
export const PASSWORD_HINT = '6-20 位，需包含数字、字母、特殊字符中的至少两类'
