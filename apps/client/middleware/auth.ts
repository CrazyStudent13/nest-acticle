// 登录守卫（route middleware）：收口原先抄在 5 个页面/布局里的登录拦截与静默恢复。
// 这些页面全部 ssr:false（见 nuxt.config routeRules），middleware 只在客户端跑；
// useUser / useAuthModal 均为 useState 实现，导航上下文内可直接调用。
//
// 行为按 definePageMeta 的自定义 meta 分档（与原页内守卫逐处对照）：
// - 默认（settings / notification / space）：未登录弹登录框并回首页；token 失效恢复失败也回首页
// - authNoToken: 'stay'（editor / creator 三页）：未登录只原地弹登录框不跳页——
//   编辑器要「登录后原地继续写」（登录成功由页内 watch(user) 续初始化），
//   创作者中心布局用登录门 UI 兜底
// - authRestoreFail: 'stay'（creator 三页）：token 失效恢复失败留在本页由登录门兜底
//   （editor 未设此项，恢复失败回首页，与原页内 catch 一致）
// - authGuestQuery: 'id'（space）：他人空间旁路——带 ?id= 看他人空间时 guest 接口公开可看，
//   不拦也不恢复；与原页内「旁路判断先于守卫」顺序一致，user 未恢复时恒按他人处理
export default defineNuxtRouteMiddleware(async (to) => {
  const { user, ensureUserRestored } = useUser()
  const { openLogin } = useAuthModal()

  // 他人空间旁路（复刻 space 页原 isSelf 判断：user 存在且 userId 与 ?id= 相等才算自己）
  const guestQuery = to.meta.authGuestQuery as string | undefined
  if (guestQuery && to.query[guestQuery]) {
    const targetId = Number(to.query[guestQuery])
    const isSelf = !!user.value?.userId && user.value.userId === targetId
    if (!isSelf) {
      return
    }
  }

  if (!getToken()) {
    openLogin()
    if (to.meta.authNoToken !== 'stay') {
      return navigateTo('/')
    }
    return
  }

  // 有 token 无用户：静默恢复登录态；恢复失败（token 失效，fetchUserInfo 内部已清空本地态）按页面档位处理
  await ensureUserRestored()
  if (!user.value && to.meta.authRestoreFail !== 'stay') {
    return navigateTo('/')
  }
})
