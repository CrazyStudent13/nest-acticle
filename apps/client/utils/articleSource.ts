// 文章类型展示文案：0 原创 1 转载 2 翻译 3 整理，与字典 post_article_source 保持一致。
// 详情/列表对游客公开可见，而字典接口要求登录态，这里本地映射兜底，未知值不展示
const ARTICLE_SOURCE_LABELS: Record<string, string> = {
  '0': '原创',
  '1': '转载',
  '2': '翻译',
  '3': '整理'
}

export const getArticleSourceLabel = (source?: string | null) => {
  return source ? ARTICLE_SOURCE_LABELS[source] || '' : ''
}