/**
 * 文章相关的线格式类型
 *
 * 契约来源（修改任一侧时必须同步）：
 * - apps/server/src/module/post/article/entities/article.entity.ts
 * - apps/server/src/module/post/article/article.service.ts（userInfo 挂载逻辑）
 */
import type { PagingParams } from './api';

/**
 * 文章作者公开信息（server 查询 sys_user 后挂载在文章行上的 userInfo）
 * 列表端点返回 userId/nickName/avatar；详情端点额外带 userName
 */
export interface ArticleUserInfo {
  userId: number;
  userName?: string;
  nickName: string;
  avatar?: string;
}

/**
 * 文章线格式类型（PostArticleEntity 的 JSON 序列化形状）
 *
 * 为兼容表单模型等局部场景，字段全部可选；真实响应中服务端列均带默认值
 * （如 likeNum/readNum/commentNum 恒为数字，publishStatus 默认 '0'）。
 * 状态字段用 string 承载（DB char(1)），取值常量见
 * PublishStatusEnum / AuditStatusEnum / ArticleSourceEnum。
 */
export interface Article {
  id?: number;
  /** 文章标题 */
  title?: string;
  /** 简介（server 落库时截断至 255） */
  desc?: string;
  /** 专栏 ID */
  subjectId?: number;
  /** 作者用户 ID */
  userId?: number;
  /** 正文 markdown */
  content?: string;
  /** 封面（相对上传路径，展示时需拼 apiBase） */
  cover?: string;
  /** 作者昵称冗余列（未填时 server 用用户昵称兜底返回） */
  author?: string;
  /** 文章来源，取值见 ArticleSourceEnum */
  source?: string;
  publishTime?: string | null;
  likeNum?: number;
  readNum?: number;
  commentNum?: number;
  /** 发布状态，取值见 PublishStatusEnum */
  publishStatus?: string;
  /** 审核状态，取值见 AuditStatusEnum */
  auditStatus?: string;
  /** 定时发布时间 */
  scheduledPublishTime?: string | null;
  auditUserId?: number;
  auditTime?: string | null;
  auditRemark?: string;
  sort?: number;
  /** 以下为 DeleteStatusEntity 通用列 */
  delFlag?: string;
  createBy?: string;
  createTime?: string | null;
  updateBy?: string;
  updateTime?: string | null;
  remark?: string;
  /** 关联作者信息（列表/详情端点挂载，查无用户时为 null） */
  userInfo?: ArticleUserInfo | null;
}

/**
 * 文章列表查询参数（对应 server ListPostArticleDto）
 */
export interface ArticleQueryParams extends PagingParams {
  /** 标题模糊搜索 */
  title?: string;
  subjectId?: number;
  /** 按作者用户 ID 过滤 */
  userId?: number;
  /** 取值见 PublishStatusEnum */
  publishStatus?: string;
  /** 取值见 AuditStatusEnum */
  auditStatus?: string;
  /** 取值见 ArticleSourceEnum */
  source?: string;
}

/**
 * 文章审核参数（对应 server AuditPostArticleDto）
 */
export interface ArticleAuditParams {
  id: number;
  /** 审核动作，取值见 AuditStatusEnum（2 通过 / 3 拒绝） */
  auditStatus: string;
  auditRemark?: string;
}
