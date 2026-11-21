/**
 * 专栏相关的线格式类型
 *
 * 契约来源（修改任一侧时必须同步）：
 * - apps/server/src/module/post/subject/entities/subject.entity.ts
 * - apps/server/src/module/post/subject/subject.service.ts（articleCount 统计挂载）
 */

/**
 * 专栏线格式类型（PostSubjectEntity 的 JSON 序列化形状）
 *
 * guest 列表/详情端点会以实时统计覆盖 articleCount；为兼容表单模型等
 * 局部场景字段全部可选。状态字段用 string 承载，取值常量见
 * PublishStatusEnum / AuditStatusEnum。
 */
export interface Subject {
  id?: number;
  /** 专栏标题 */
  title?: string;
  desc?: string;
  /** 创建者用户 ID */
  userId?: number;
  /** 封面（相对上传路径，展示时需拼 apiBase） */
  cover?: string;
  /** 作者昵称冗余列 */
  author?: string;
  /** 专栏内文章数量（server 恒返回，guest 端点为实时统计值） */
  articleCount?: number;
  /** 发布状态，取值见 PublishStatusEnum */
  publishStatus?: string;
  /** 审核状态，取值见 AuditStatusEnum */
  auditStatus?: string;
  scheduledPublishTime?: string | null;
  auditUserId?: number;
  auditTime?: string | null;
  auditRemark?: string;
  sort?: number;
  /** 以下为 BaseEntity 通用列 */
  delFlag?: string;
  /** 数据状态（0 正常 1 停用） */
  status?: string;
  createBy?: string;
  createTime?: string | null;
  updateBy?: string;
  updateTime?: string | null;
  remark?: string;
}
