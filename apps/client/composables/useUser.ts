// 用户登录态：token 存 cookie，用户信息存全局 state（刷新页面后靠 getInfo 恢复）
export interface AuthUser {
  userId: number
  userName: string
  nickName: string
  email: string
  avatar: string
  sex?: string
  createTime?: string
  signature?: string
}

export interface CaptchaInfo {
  captchaEnabled: boolean
  img: string
  uuid: string
}

export interface RegisterConfig {
  emailRegisterEnabled: boolean
}

export interface RegisterPayload {
  username: string
  password: string
  email?: string
  emailCode?: string
  code?: string
  uuid?: string
}

export const useUser = () => {
  const user = useState<AuthUser | null>('auth-user', () => null)
  const isLoggedIn = computed(() => !!user.value)

  // 登录：成功后写入 token 并拉取用户信息
  // username 字段按后端 LoginDto 命名，值传邮箱（后端暂按 userName 查询，邮箱直登待后端放开）
  const login = async (payload: { username: string; password: string; code?: string; uuid?: string }) => {
    const res = await apiFetch<{ token: string }>('/api/login', { method: 'POST', body: payload })
    setToken(res.data?.token)
    await fetchUserInfo()
    return res
  }

  // 注册：后端开启邮箱验证码时须带 email + emailCode，否则须带图片验证码 code + uuid
  // 成功后无 data，由调用方引导用户登录；后端 nickName 默认取账号本身
  const register = async (payload: RegisterPayload) => {
    return await apiFetch('/api/register', { method: 'POST', body: payload })
  }

  // 注册页配置：决定注册用邮箱验证码还是图片验证码
  const fetchRegisterConfig = async (): Promise<RegisterConfig> => {
    try {
      const res = await apiFetch<RegisterConfig>('/api/register/config')
      return res.data ?? { emailRegisterEnabled: false }
    } catch {
      return { emailRegisterEnabled: false }
    }
  }

  // 发送注册邮箱验证码（后端有 60 秒冷却与每小时上限）
  const sendRegisterEmailCode = async (email: string) => {
    await apiFetch('/api/register/emailCode', { method: 'POST', body: { email } })
  }

  // 当前登录用户信息（token 失效时清空登录态）
  const fetchUserInfo = async () => {
    try {
      const res = await apiFetch('/api/getInfo')
      // getInfo 的 user 在顶层而非 data 里；响应带密码散列，只保留展示需要的字段
      const raw: any = (res as any).user
      user.value = raw
        ? {
            userId: raw.userId,
            userName: raw.userName,
            nickName: raw.nickName,
            email: raw.email,
            avatar: raw.avatar,
            sex: raw.sex,
            createTime: raw.createTime,
            signature: raw.signature
          }
        : null
    } catch (error) {
      clearToken()
      user.value = null
      throw error
    }
  }

  // 有 token 无用户时静默恢复登录态：头部/文章详情页的组件级恢复与 auth middleware 守卫共用
  // 失败静默不外抛（fetchUserInfo 内部已清空本地态），调用方按各自场景兜底
  const ensureUserRestored = async () => {
    if (getToken() && !user.value) {
      try {
        await fetchUserInfo()
      } catch {
        // 与原头部/详情页的 .catch(() => {}) 行为一致：恢复失败不阻塞渲染
      }
    }
  }

  // 仅清本地登录态（不请求后端）：供 apiFetch 的 401 统一出口使用
  // （logout 会请求 /api/logout，token 已失效时反而再吃一个 401）
  const clearLocalAuth = () => {
    clearToken()
    user.value = null
  }

  // 验证码：登录场景按账号失败次数动态判断（3 次后返回 captchaEnabled: true）；
  // 注册场景传 type='register' 无条件生成图片验证码
  const fetchCaptcha = async (username: string, type?: 'register'): Promise<CaptchaInfo> => {
    try {
      const res = await apiFetch<CaptchaInfo>('/api/captchaImage', {
        query: type ? { username, type } : { username }
      })
      return res.data ?? { captchaEnabled: false, img: '', uuid: '' }
    } catch {
      // 验证码接口异常时按无验证码处理，由登录接口的报错兜底
      return { captchaEnabled: false, img: '', uuid: '' }
    }
  }

  // 退出：无论接口结果如何都清空本地登录态
  const logout = async () => {
    try {
      await apiFetch('/api/logout', { method: 'POST' })
    } catch {
      // 接口失败不阻塞本地退出
    }
    clearToken()
    user.value = null
  }

  // 修改个人资料：昵称/邮箱/性别/个性签名，成功后同步本地 state（头部昵称即时更新）
  const updateProfile = async (payload: { nickName?: string; email?: string; sex?: string; signature?: string }) => {
    await apiFetch('/api/system/user/profile', { method: 'PUT', body: payload })
    if (user.value) {
      user.value = { ...user.value, ...payload }
    }
  }

  // 上传头像：form-data 字段名固定为 avatarfile，返回后端生成的相对路径并同步本地 state
  const updateAvatar = async (file: File) => {
    const form = new FormData()
    form.append('avatarfile', file)
    const res = await apiFetch<{ imgUrl: string }>('/api/system/user/profile/avatar', {
      method: 'POST',
      body: form
    })
    const imgUrl = res.data?.imgUrl || ''
    if (user.value && imgUrl) {
      user.value = { ...user.value, avatar: imgUrl }
    }
    return imgUrl
  }

  // 修改密码：旧密码 + 新密码（旧密码由后端 bcrypt 比对校验，参数顺序已修正）
  const updatePassword = async (payload: { oldPassword: string; newPassword: string }) => {
    await apiFetch('/api/system/user/profile/updatePwd', { method: 'PUT', body: payload })
  }

  return {
    user,
    isLoggedIn,
    login,
    register,
    fetchRegisterConfig,
    sendRegisterEmailCode,
    fetchUserInfo,
    ensureUserRestored,
    clearLocalAuth,
    fetchCaptcha,
    logout,
    updateProfile,
    updateAvatar,
    updatePassword
  }
}
