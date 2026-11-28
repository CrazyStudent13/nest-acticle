// 文章类型展示文案：单一事实来源收口到 @nest-acticle/shared（ARTICLE_SOURCE_LABELS，与字典
// post_article_source 对齐），这里 re-export 维持既有导入路径。
// 详情/列表对游客公开可见，而字典接口游客仅放行公开字典，本地映射兜底，未知值不展示
import { ARTICLE_SOURCE_LABELS, ArticleSourceEnum } from '@nest-acticle/shared'

export { ARTICLE_SOURCE_LABELS }

export const getArticleSourceLabel = (source?: string | null) => {
  return source ? ARTICLE_SOURCE_LABELS[source as ArticleSourceEnum] || '' : ''
}
