/**
 * 举报相关的线格式类型
 *
 * 契约来源（修改任一侧时必须同步）：
 * - apps/server/src/module/post/report/report.service.ts（提交/状态查询返回载荷）
 * - 数据库表 post_report：同一目标同时至多一条待处理举报（uk_reporter_pending 唯一索引 + pending_flag 的 NULL 豁免），
 *   处理完成（成立/驳回）后可再次举报，历史多行共存；
 *   举报理由/目标类型取字典 post_report_reason / post_report_target 的 dictValue；
 *   处理反馈走 sys_notice 定向通知（type=3 举报反馈），前台「系统通知」栏承接
 */

/**
 * 举报目标类型（字典 post_report_target 的 dictValue）
 * 流程能力按值写死在服务端（文章才能下架、用户才能停用），扩评论举报时字典与两侧代码同步加值
 */
export type ReportTargetType = 'post' | 'user'
