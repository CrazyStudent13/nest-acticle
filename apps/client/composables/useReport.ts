// 用户举报：提交/是否已举报过。
// 举报要求登录态（匿名举报不开放），调用方须保证守卫先行；
// 同一目标同时至多一条待处理举报（服务端唯一索引兜底），存在待处理举报时提交会报错「请耐心等待处理结果」；
// 处理反馈走 sys_notice 定向通知（type=3 举报反馈），在通知中心「系统通知」栏承接，不经本域拉取；
// 举报理由/目标类型走字典 post_report_reason / post_report_target（useDict 拉取），前端不写死枚举
import type { ReportTargetType } from '@nest-acticle/shared'

export const useReport = () => {
  // 提交举报：targetType=post 文章 / user 用户；reasonType 为字典 dictValue；reasonContent 补充说明可空
  const submitReport = async (data: { targetType: ReportTargetType; targetId: number | string; reasonType: string; reasonContent?: string }) => {
    const res = await apiFetch<{ reported: boolean }>('/api/post/report', {
      method: 'POST',
      body: {
        targetType: data.targetType,
        targetId: data.targetId,
        reasonType: data.reasonType,
        ...(data.reasonContent ? { reasonContent: data.reasonContent } : {})
      }
    })
    return res.data ?? { reported: true }
  }

  // 当前用户对目标是否已举报过（举报按钮「已举报」置灰态，须登录后调用）
  const fetchReportStatus = async (
    targetType: ReportTargetType,
    targetId: number | string
  ): Promise<{ reported: boolean } | null> => {
    const res = await apiFetch<{ reported: boolean }>(`/api/post/report/status/${targetType}/${targetId}`)
    return res.data ?? null
  }

  return { submitReport, fetchReportStatus }
}
