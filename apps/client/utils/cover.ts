// 封面地址补全：后端可能返回相对路径（/profile/...），需要拼上服务器地址
// 拼接核心逻辑收敛到 @nest-acticle/utils 的 joinFileUrl，这里保留 toCoverUrl 语义入口
import { joinFileUrl } from '@nest-acticle/utils'

export const toCoverUrl = (apiBase: string, cover?: string | null) => {
  return joinFileUrl(apiBase, cover)
}
