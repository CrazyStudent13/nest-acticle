/**
 * 收藏集相关的线格式类型
 *
 * 契约来源（修改任一侧时必须同步）：
 * - apps/server/src/module/post/collection/entities/collection.entity.ts
 * - apps/server/src/module/post/collection/collection.service.ts（列表/详情/状态载荷）
 * - 数据库表 post_collection / post_collection_article / post_collection_sub：
 *   一集一文一条收藏记录（uk_collection_article），一集一人一条订阅记录（uk_collection_user）
 */
import type { Article, ArticleUserInfo } from './article';

/**
 * 收藏集线格式类型（PostCollectionEntity 的 JSON 序列化形状）
 *
 * 列表/详情端点会联查回填 userInfo（创建者公开信息）；字段可选以兼容表单模型等局部场景。
 * visibility 用 string 承载（DB char(1)）：'0' 公开 / '1' 私密。
 */
export interface Collection {
  id?: number;
  /** 创建者用户 ID */
  userId?: number;
  /** 收藏集名称 */
  name?: string;
  desc?: string;
  /** 可见性：'0' 公开（可订阅） / '1' 私密（仅创建者可见） */
  visibility?: string;
  /** 收录文章数量（server 维护的实时计数） */
  articleCount?: number;
  /** 订阅人数（server 维护的实时计数） */
  subscriberCount?: number;
  createTime?: string | null;
  updateTime?: string | null;
  /** 创建者公开信息（列表/详情端点联查回填） */
  userInfo?: ArticleUserInfo | null;
}

/**
 * 收藏集内文章行：已发布文章的公开线格式 + 收藏时间
 * （收藏集详情页文章列表用，排序默认按 collectTime 倒序）
 */
export interface CollectionArticleItem extends Article {
  /** 该文章被收进收藏集的时间 */
  collectTime?: string | null;
}

/**
 * 收藏弹窗行：当前用户的一个收藏集 + 该文章是否已在其中
 * （GET /post/collection/status/:articleId 返回，勾选后 diff 出 collect/uncollect 调用）
 */
export interface CollectionStatusItem {
  id: number;
  name: string;
  /** '0' 公开 / '1' 私密 */
  visibility: string;
  /** 该文章当前是否已收藏进此收藏集 */
  collected: boolean;
}

/**
 * 「收到的收藏」通知行（通知中心赞和收藏栏）：他人把我发布的文章收进了 ta 的公开收藏集
 * 私密收藏集不产生通知行；文章/收藏集删除后不再出现在列表中
 */
export interface ReceivedCollectItem {
  /** 收藏记录 id（列表 key） */
  id: number;
  /** 收藏人 userID（跳个人空间） */
  userId: number;
  nickName: string;
  avatar?: string | null;
  /** 收进的目标收藏集 */
  collectionId: number;
  collectionName: string | null;
  /** 被收藏的文章 */
  articleId: number;
  articleTitle: string | null;
  articleCover?: string | null;
  /** 收藏时间 */
  createTime: string;
}
