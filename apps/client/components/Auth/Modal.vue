<!-- 登录/注册共用弹窗（useAuthModal 控制开合，挂 app.vue）：输入实时过滤+失焦校验，注册带密码强度条、成功后放礼花并切回登录带上邮箱；验证码仅在账号连续登录失败达阈值（3 次）后出现，登录失败自动重取状态 -->
<template>
  <Teleport to="body">
    <!-- 显式时长：不依赖 transitionend 事件，避免过渡卡在中间态（透明遮罩挡住全页） -->
    <Transition name="auth-modal" :duration="200">
      <div v-if="isOpen" class="auth-mask" @click.self="handleMaskClick" @keydown.esc="close">
        <div class="auth-panel" role="dialog" aria-modal="true" :aria-label="title">
          <header class="panel-head">
            <h2 class="panel-title">{{ title }}</h2>
            <button class="close-btn" type="button" aria-label="关闭" @click="close">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
                <path
                  d="M18.3 5.71 12 12.01l-6.3-6.3-1.41 1.41 6.3 6.3-6.3 6.3 1.41 1.41 6.3-6.3 6.3 6.3 1.41-1.41-6.3-6.3 6.3-6.3-1.41-1.41z"
                />
              </svg>
            </button>
          </header>

          <!-- novalidate：关闭浏览器原生校验气泡，统一用表单内的自定义提示 -->
          <form class="panel-body" novalidate @submit.prevent="handleSubmit">
            <div class="field-group">
              <input
                v-model="form.email"
                class="field"
                :class="fieldClass('email')"
                type="email"
                maxlength="50"
                placeholder="请输入邮箱"
                @input="stripInvalidEmailChars"
                @compositionend="stripInvalidEmailChars"
                @keydown="blockSpaceKey"
                @blur="onBlur('email')"
              />
              <p v-if="fieldError('email')" class="field-tip">{{ errors.email }}</p>
            </div>

            <div class="field-group">
              <div class="field-wrap">
                <input
                  v-model="form.password"
                  class="field"
                  :class="[fieldClass('password'), { 'has-forgot': mode === 'login' }]"
                  type="password"
                  maxlength="20"
                  :placeholder="mode === 'register' ? '请设置登录密码' : '请输入登录密码'"
                  @input="stripSpaces('password')"
                  @compositionend="stripSpaces('password')"
                  @keydown="blockSpaceKey"
                  @blur="onBlur('password')"
                />
                <button v-if="mode === 'login'" class="forgot" type="button" @click="showToast('请联系管理员重置密码', 'info')">
                  忘记密码
                </button>
              </div>

              <div v-if="mode === 'register' && form.password" class="strength">
                <div class="strength-bars">
                  <span v-for="n in 3" :key="n" class="strength-bar" :class="strengthBarClass(n)" />
                </div>
                <span class="strength-label" :class="`strength-${strength}`">{{ strengthLabel }}</span>
              </div>

              <!-- 注册模式常驻提示：出错时让位给红色错误提示 -->
              <p v-if="mode === 'register' && !fieldError('password')" class="field-hint">{{ PASSWORD_HINT }}</p>
              <p v-if="fieldError('password')" class="field-tip">{{ errors.password }}</p>
            </div>

            <!-- 验证码：后端仅在账号连续登录失败达到阈值（3 次）时要求 -->
            <div v-if="mode === 'login' && captcha.enabled" class="field-group">
              <div class="captcha-row">
                <input
                  v-model="captcha.code"
                  class="field"
                  :class="{ 'field-error': captcha.codeTouched && !captcha.code.trim() }"
                  type="text"
                  maxlength="5"
                  placeholder="请输入验证码"
                  @blur="captcha.codeTouched = true"
                />
                <img
                  v-if="captcha.img"
                  class="captcha-img"
                  :src="captchaSrc(captcha.img)"
                  alt="验证码"
                  title="看不清？点击刷新"
                  @click="refreshCaptcha"
                />
              </div>
              <p v-if="captcha.codeTouched && !captcha.code.trim()" class="field-tip">请输入验证码</p>
            </div>

            <div v-if="mode === 'register'" class="field-group">
              <input
                v-model="form.confirm"
                class="field"
                :class="fieldClass('confirm')"
                  type="password"
                  maxlength="20"
                  placeholder="请再次输入密码"
                @input="stripSpaces('confirm')"
                @compositionend="stripSpaces('confirm')"
                @keydown="blockSpaceKey"
                @blur="onBlur('confirm')"
              />
              <p v-if="fieldError('confirm')" class="field-tip">{{ errors.confirm }}</p>
            </div>

            <!-- 注册图片验证码：后端未开启邮箱验证码注册时使用 -->
            <div v-if="mode === 'register' && registerConfig.ready && !registerConfig.emailRegisterEnabled" class="field-group">
              <div class="captcha-row">
                <input
                  v-model="registerCaptcha.code"
                  class="field"
                  :class="{ 'field-error': registerCaptcha.codeTouched && !registerCaptcha.code.trim() }"
                  type="text"
                  maxlength="5"
                  placeholder="请输入验证码"
                  @blur="registerCaptcha.codeTouched = true"
                />
                <img
                  v-if="registerCaptcha.img"
                  class="captcha-img"
                  :src="captchaSrc(registerCaptcha.img)"
                  alt="验证码"
                  title="看不清？点击刷新"
                  @click="refreshRegisterCaptcha"
                />
                <!-- 加载失败/加载中占位：与验证码图同尺寸，可点击重试，避免无图可点导致提交被拦死 -->
                <div
                  v-else
                  class="captcha-img captcha-retry"
                  :title="registerCaptcha.loading ? '验证码加载中' : '验证码加载失败，点击重试'"
                  @click="refreshRegisterCaptcha"
                >
                  {{ registerCaptcha.loading ? '加载中…' : '加载失败，点击重试' }}
                </div>
              </div>
              <p v-if="registerCaptcha.codeTouched && !registerCaptcha.code.trim()" class="field-tip">请输入验证码</p>
            </div>

            <!-- 邮箱验证码：放最后填（临近注册按钮），5 分钟时效短，先填容易过期 -->
            <div v-if="mode === 'register' && registerConfig.emailRegisterEnabled" class="field-group">
              <div class="field-wrap">
                <input
                  v-model="form.emailCode"
                  class="field"
                  :class="[fieldClass('emailCode'), 'has-code']"
                  type="text"
                  maxlength="6"
                  placeholder="请输入邮箱验证码"
                  @input="stripNonDigits('emailCode')"
                  @compositionend="stripNonDigits('emailCode')"
                  @keydown="blockSpaceKey"
                  @blur="onBlur('emailCode')"
                />
                <!-- 获取验证码内嵌在验证码输入框内：发送前校验邮箱，60 秒冷却 -->
                <button
                  class="send-code"
                  type="button"
                  :disabled="sendingCode || cooldown > 0"
                  @click="handleSendEmailCode"
                >
                  {{ cooldown > 0 ? `${cooldown}s 后重发` : sendingCode ? '发送中…' : '获取验证码' }}
                </button>
              </div>
              <p v-if="fieldError('emailCode')" class="field-tip">{{ errors.emailCode }}</p>
            </div>

            <button class="submit-btn" type="submit" :disabled="submitting">
              {{ mode === 'login' ? '登录' : '注册' }}
            </button>
          </form>

          <footer class="panel-foot">
            <span class="agreement">
              {{ mode === 'login' ? '登录' : '注册' }}即表示同意
              <a href="/agreement.html" target="_blank" rel="noopener">用户协议</a> 和
              <a href="/privacy.html" target="_blank" rel="noopener">隐私政策</a>
            </span>
            <button class="switch-btn" type="button" @click="switchMode">
              {{ mode === 'login' ? '注册' : '登录' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
// 登录/注册弹窗：登录与注册共用一个弹窗，通过 mode 切换
const { isOpen, mode, close } = useAuthModal()
const { login, register, fetchCaptcha, fetchRegisterConfig, sendRegisterEmailCode } = useUser()

const title = computed(() => (mode.value === 'login' ? '登录游戏速递' : '注册游戏速递'))

type FormField = 'email' | 'password' | 'confirm' | 'emailCode'

const form = reactive({
  email: '',
  password: '',
  confirm: '',
  emailCode: ''
})

const touched = reactive<Record<FormField, boolean>>({
  email: false,
  password: false,
  confirm: false,
  emailCode: false
})

// 邮箱格式：local 部分仅限常见字符（字母数字与 ._%+-），域名须为「标签.」+ 至少 2 位字母顶级域名
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/

// 后端「账号已存在」类错误特征：用户名占用、邮箱占用、并发撞唯一索引，统一转成登录引导
const ACCOUNT_EXISTS_HINTS = ['注册账号已存在', '该邮箱已被其他账号使用', '该账号已注册']

const errors = computed<Record<FormField, string>>(() => ({
  email: !form.email.trim()
    ? '请输入邮箱'
    : EMAIL_RE.test(form.email.trim())
      ? ''
      : '邮箱格式不正确',
  password: !form.password
    ? '请输入密码'
    : form.password.length < 6
      ? '密码长度不能少于 6 位'
      // 复杂度仅注册时校验：登录不拦，老账号的弱密码要能正常登录
      : mode.value === 'register' && !isPasswordComplexEnough(form.password)
        ? '需包含数字、字母、特殊字符中的至少两类'
        : '',
  confirm:
    mode.value !== 'register'
      ? ''
      : !form.confirm
        ? '请再次输入密码'
        : form.confirm !== form.password
          ? '两次输入的密码不一致'
          : '',
  emailCode:
    mode.value !== 'register' || !registerConfig.ready || !registerConfig.emailRegisterEnabled
      ? ''
      : !form.emailCode.trim()
        ? '请输入邮箱验证码'
        : !/^\d{6}$/.test(form.emailCode.trim())
          ? '验证码为 6 位数字'
          : ''
}))

// 实时校验：字段失焦后开始显示错误，输入过程中错误随修正即时消失
const touchField = (field: FormField) => {
  touched[field] = true
}

// 输入过滤：邮箱实时剔除空格与特殊字符，只保留合法字符（键入与粘贴均覆盖）
const stripInvalidEmailChars = () => {
  const cleaned = form.email.replace(/[^A-Za-z0-9._%+-@]/g, '')
  if (cleaned !== form.email) {
    form.email = cleaned
  }
}

// 输入过滤：密码不允许包含空格（键入与粘贴均覆盖）
const stripSpaces = (field: FormField) => {
  if (/\s/.test(form[field])) {
    form[field] = form[field].replace(/\s/g, '')
  }
}

// 输入过滤：验证码只保留数字
const stripNonDigits = (field: FormField) => {
  if (/\D/.test(form[field])) {
    form[field] = form[field].replace(/\D/g, '')
  }
}

// 拦截空格键：真人键入的空格直接不让进框（粘贴/输入法提交/自动填充由 input、compositionend、blur 过滤兜底）
const blockSpaceKey = (event: KeyboardEvent) => {
  if (event.key === ' ') {
    event.preventDefault()
  }
}

// 失焦时去除首尾空格，覆盖自动填充等绕过实时过滤的场景
const trimField = (field: FormField) => {
  if (/^\s|\s$/.test(form[field])) {
    form[field] = form[field].trim()
  }
}

// 失焦：先去首尾空格，再标记已触碰，保证校验基于清理后的值
const onBlur = (field: FormField) => {
  trimField(field)
  touchField(field)
}

const fieldError = (field: FormField) => (touched[field] ? errors.value[field] : '')
const fieldValid = (field: FormField) => touched[field] && !errors.value[field] && !!form[field]
const fieldClass = (field: FormField) => ({
  'field-error': !!fieldError(field),
  'field-valid': fieldValid(field)
})

// 密码强度：字符种类数定级（<6 位视为太短）—— 1 弱（单一类）/ 2 中（两类）/ 3 强（三类必含特殊字符）
const strength = computed(() => passwordStrength(form.password))

const strengthLabel = computed(() => ['太短了', '弱', '中', '强'][strength.value] ?? '')
const strengthBarClass = (n: number) => ({ on: strength.value >= n, [`lv-${strength.value}`]: strength.value >= n })

const submitting = ref(false)

// 验证码状态：后端仅在账号连续登录失败达到阈值（3 次）时要求
const captcha = reactive({
  enabled: false,
  img: '',
  uuid: '',
  code: '',
  codeTouched: false
})

const resetCaptcha = () => {
  captcha.code = ''
  captcha.codeTouched = false
}

// 拉取验证码状态：正常账号返回 captchaEnabled=false，输错 3 次后才出图
const refreshCaptcha = async () => {
  const info = await fetchCaptcha(form.email.trim())
  captcha.enabled = !!info.captchaEnabled
  captcha.img = info.img || ''
  captcha.uuid = info.uuid || ''
  resetCaptcha()
}

// 验证码图片：后端返回裸 SVG 文本，转成 data URI 才能给 <img src> 使用
const captchaSrc = (svg: string) => {
  if (!svg) return ''
  if (svg.startsWith('data:')) return svg
  return svg.startsWith('<svg') ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : svg
}

// 注册配置：后端开启邮箱验证码注册时展示邮箱验证码，否则展示图片验证码
// ready 用于避免配置返回前误展示图片验证码
const registerConfig = reactive({ ready: false, emailRegisterEnabled: false })

const registerCaptcha = reactive({
  img: '',
  uuid: '',
  code: '',
  codeTouched: false,
  loading: false
})

const refreshRegisterCaptcha = async () => {
  registerCaptcha.loading = true
  try {
    const info = await fetchCaptcha(form.email.trim(), 'register')
    registerCaptcha.img = info.img || ''
    registerCaptcha.uuid = info.uuid || ''
    registerCaptcha.code = ''
    registerCaptcha.codeTouched = false
  } finally {
    registerCaptcha.loading = false
  }
}

const refreshRegisterConfig = async () => {
  const config = await fetchRegisterConfig()
  registerConfig.emailRegisterEnabled = !!config.emailRegisterEnabled
  registerConfig.ready = true
  if (!registerConfig.emailRegisterEnabled) {
    await refreshRegisterCaptcha()
  }
}

// 邮箱验证码发送冷却：与后端 60 秒限制保持一致
const sendingCode = ref(false)
const cooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | null = null

const stopCooldown = () => {
  if (cooldownTimer) {
    clearInterval(cooldownTimer)
    cooldownTimer = null
  }
  cooldown.value = 0
}

const startCooldown = (seconds: number) => {
  stopCooldown()
  cooldown.value = seconds
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0) {
      stopCooldown()
    }
  }, 1000)
}

const handleSendEmailCode = async () => {
  touched.email = true
  if (errors.value.email) {
    // 邮箱非法时明确告知，不再静默返回
    showToast(errors.value.email, 'error')
    return
  }
  sendingCode.value = true
  try {
    await sendRegisterEmailCode(form.email.trim())
    showToast('验证码已发送，请查收邮件', 'success')
    startCooldown(60)
  } catch (error: any) {
    showToast(error?.message || '验证码发送失败，请稍后重试', 'error')
  } finally {
    sendingCode.value = false
  }
}

const resetForm = () => {
  form.email = ''
  form.password = ''
  form.confirm = ''
  form.emailCode = ''
  touched.email = false
  touched.password = false
  touched.confirm = false
  touched.emailCode = false
  resetCaptcha()
  stopCooldown()
  registerCaptcha.img = ''
  registerCaptcha.uuid = ''
  registerCaptcha.code = ''
  registerCaptcha.codeTouched = false
  registerCaptcha.loading = false
}

const switchMode = () => {
  mode.value = mode.value === 'login' ? 'register' : 'login'
  resetForm()
  if (mode.value === 'login') {
    // 切回登录模式时重取验证码状态
    refreshCaptcha()
  } else {
    // 切到注册模式时按后端配置决定验证方式
    refreshRegisterConfig()
  }
}

// 点击遮罩关闭：仅登录模式允许；注册填到一半误触丢失内容太伤，点遮罩不关闭
const handleMaskClick = () => {
  if (mode.value === 'login') {
    close()
  }
}

const handleSubmit = async () => {
  // 注册配置未返回时先取回，确保邮箱验证码字段参与校验
  if (mode.value !== 'login' && !registerConfig.ready) {
    await refreshRegisterConfig()
  }

  touched.email = true
  touched.password = true
  touched.confirm = true
  touched.emailCode = true

  if (errors.value.email || errors.value.password || errors.value.confirm || errors.value.emailCode) {
    // 字段下仍保留内联提示，这里再用 toast 报第一条错误，避免点提交看起来无反应
    const firstError = [errors.value.email, errors.value.password, errors.value.confirm, errors.value.emailCode].find(Boolean)
    if (firstError) showToast(firstError, 'error')
    return
  }

  // 注册：成功后切回登录模式并带上刚注册的邮箱，引导用户登录
  if (mode.value !== 'login') {
    if (!registerConfig.emailRegisterEnabled && !registerCaptcha.code.trim()) {
      registerCaptcha.codeTouched = true
      showToast('请输入验证码', 'error')
      return
    }
    submitting.value = true
    try {
      const username = form.email.trim()
      if (registerConfig.emailRegisterEnabled) {
        await register({ username, password: form.password, email: username, emailCode: form.emailCode.trim() })
      } else {
        await register({ username, password: form.password, code: registerCaptcha.code.trim(), uuid: registerCaptcha.uuid })
      }
      mode.value = 'login'
      resetForm()
      form.email = username
      refreshCaptcha()
      fireConfetti()
      showToast('注册成功，请登录', 'success')
    } catch (error: any) {
      const message = error?.message || ''
      // 账号已存在单独给登录引导，其余错误原样提示
      if (ACCOUNT_EXISTS_HINTS.some((hint) => message.includes(hint))) {
        showToast('该邮箱已注册，请直接登录', 'error')
      } else {
        showToast(message || '注册失败，请稍后重试', 'error')
      }
      // 图片验证码一次性使用，失败后需重新获取
      if (!registerConfig.emailRegisterEnabled) {
        await refreshRegisterCaptcha()
      }
    } finally {
      submitting.value = false
    }
    return
  }

  if (captcha.enabled && !captcha.code.trim()) {
    captcha.codeTouched = true
    showToast('请输入验证码', 'error')
    return
  }

  submitting.value = true
  try {
    await login({
      username: form.email.trim(),
      password: form.password,
      ...(captcha.enabled ? { code: captcha.code.trim(), uuid: captcha.uuid } : {})
    })
    close()
  } catch (error: any) {
    showToast(error?.message || '登录失败，请稍后重试', 'error')
    // 登录失败会累计错误次数，重取验证码状态（达到阈值后自动展示）
    await refreshCaptcha()
  } finally {
    submitting.value = false
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    close()
  }
}

watch(isOpen, (open) => {
  if (open) {
    resetForm()
    // 打开弹窗时预取验证方式（登录按失败次数、注册按后端配置）
    if (mode.value === 'login') {
      refreshCaptcha()
    } else {
      refreshRegisterConfig()
    }
    window.addEventListener('keydown', handleKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    window.removeEventListener('keydown', handleKeydown)
    document.body.style.overflow = ''
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
  stopCooldown()
})
</script>

<style lang="less" scoped>
.auth-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.5);
}

.auth-panel {
  width: 100%;
  max-width: 400px;
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2);
  overflow: hidden;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;

  .panel-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-1);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border: 0;
    background-color: transparent;
    color: var(--color-text-3);
    cursor: pointer;
    transition: color 0.2s ease;

    &:hover {
      color: var(--color-text-1);
    }
  }
}

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 8px 24px 24px;

  .field-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field-wrap {
    position: relative;
  }

  .field {
    width: 100%;
    padding: 11px 14px;
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius-sm);
    background-color: var(--color-bg);
    font-size: 14px;
    color: var(--color-text-1);
    outline: none;
    transition:
      border-color 0.2s ease,
      background-color 0.2s ease;

    &::placeholder {
      color: var(--color-text-3);
    }

    &:focus {
      border-color: var(--color-primary);
      background-color: var(--color-surface);
    }

    // 校验通过：绿色描边
    &.field-valid,
    &.field-valid:focus {
      border-color: #1a7f37;
    }

    // 校验失败：红色描边
    &.field-error,
    &.field-error:focus {
      border-color: #d1242f;
    }

    // 隐藏 Edge/WebView2 原生的密码显隐按钮，避免与右侧悬浮元素重叠
    &::-ms-reveal,
    &::-ms-clear {
      display: none;
    }

    // 给"忘记密码"按钮预留空间，避免输入内容从其下方穿过
    &.has-forgot {
      padding-right: 72px;
    }

    // 给"获取验证码"按钮预留空间
    &.has-code {
      padding-right: 104px;
    }
  }

  .send-code {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    padding: 6px 8px;
    border: 0;
    background-color: transparent;
    font-size: 12px;
    color: var(--color-primary);
    cursor: pointer;
    white-space: nowrap;

    &:disabled {
      color: var(--color-text-3);
      cursor: not-allowed;
    }
  }

  .forgot {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    border: 0;
    background-color: transparent;
    font-size: 12px;
    color: var(--color-text-3);
    cursor: pointer;

    &:hover {
      color: var(--color-primary);
    }
  }

  .captcha-row {
    display: flex;
    align-items: center;
    gap: 10px;

    .field {
      flex: 1;
      min-width: 0;
    }

    .captcha-img {
      height: 42px;
      flex-shrink: 0;
      border-radius: var(--radius-sm);
      cursor: pointer;
    }

    // 验证码加载失败/加载中占位框：与图片同高、固定宽度，可点击重试
    .captcha-retry {
      width: 96px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px dashed var(--color-border);
      font-size: 12px;
      color: var(--color-text-3);
      user-select: none;
    }
  }

  .field-tip {
    font-size: 12px;
    line-height: 18px;
    color: #d1242f;
  }

  .field-hint {
    font-size: 12px;
    line-height: 18px;
    color: var(--color-text-3);
  }

  // 密码强度指示
  .strength {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 2px;

    .strength-bars {
      display: flex;
      gap: 4px;
      flex: 1;

      .strength-bar {
        height: 4px;
        flex: 1;
        border-radius: 2px;
        background-color: var(--color-border);
        transition: background-color 0.2s ease;

        &.on.lv-1 {
          background-color: #d1242f;
        }
        &.on.lv-2 {
          background-color: #d29922;
        }
        &.on.lv-3 {
          background-color: #1a7f37;
        }
      }
    }

    .strength-label {
      font-size: 12px;
      color: var(--color-text-3);

      &.strength-1 {
        color: #d1242f;
      }
      &.strength-2 {
        color: #d29922;
      }
      &.strength-3 {
        color: #1a7f37;
      }
    }
  }

  .submit-btn {
    padding: 11px;
    border: 0;
    border-radius: var(--radius-sm);
    background-color: var(--color-primary);
    color: #fff;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      opacity 0.2s ease;

    &:hover {
      background-color: var(--color-primary-hover);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.panel-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px 20px;

  .agreement {
    font-size: 12px;
    color: var(--color-text-3);

    a {
      color: var(--color-primary);

      &:hover {
        text-decoration: underline;
      }
    }
  }

  .switch-btn {
    border: 0;
    background-color: transparent;
    font-size: 13px;
    color: var(--color-text-2);
    cursor: pointer;
    transition: color 0.2s ease;

    &:hover {
      color: var(--color-primary);
    }
  }
}

// 过渡动画
.auth-modal-enter-active,
.auth-modal-leave-active {
  transition: opacity 0.2s ease;

  .auth-panel {
    transition: transform 0.2s ease;
  }
}

// 离开过渡期间遮罩不再拦截点击：窗口被遮挡等极端情况下过渡延迟完成时，页面仍可正常操作
.auth-modal-leave-active {
  pointer-events: none;
}

.auth-modal-enter-from,
.auth-modal-leave-to {
  opacity: 0;

  .auth-panel {
    transform: translateY(-8px);
  }
}
</style>
