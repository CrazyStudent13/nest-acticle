import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 举报实体类
 * 对应数据库表：post_report
 * 同一人对同一目标**同时至多一条待处理举报**（uk_reporter_pending 唯一索引 + pending_flag 的
 * NULL 豁免技巧：待处理=1、处理完置 NULL——待处理中重复提交被索引拦下（INSERT IGNORE 兜底并发），
 * 处理完成后可再次举报，历史多行共存）；不软删，管理端批量删除物理删除（同 post_follow 口径）。
 * 举报理由/目标类型存字典 dictValue（post_report_reason / post_report_target），
 * 流程能力（下架/停用）按 targetType 写死在服务端，字典只管展示与合法值校验
 */
@Entity('post_report', { comment: '举报库' })
@Index('uk_reporter_pending', ['reporterId', 'targetType', 'targetId', 'pendingFlag'], { unique: true })
@Index('idx_target_status', ['targetType', 'targetId', 'status'])
@Index('idx_reporter_create', ['reporterId', 'createTime'])
export class PostReportEntity {
  @ApiProperty({ type: Number, description: '举报 id' })
  @PrimaryGeneratedColumn({ name: 'id', comment: '举报 id' })
  public id: number;

  @ApiProperty({ type: String, description: '举报目标类型（post 文章 / user 用户）' })
  @Column({ type: 'varchar', name: 'target_type', length: 8, comment: '举报目标类型（post 文章 / user 用户）' })
  public targetType: string;

  @ApiProperty({ type: Number, description: '举报目标ID（post=文章 id，user=用户 id）' })
  @Column({ type: 'int', name: 'target_id', comment: '举报目标ID（post=文章 id，user=用户 id）' })
  public targetId: number;

  // 举报时的目标快照：文章取「标题 · 简介」、用户取昵称，提交时落库。
  // 目标后续编辑标题/改昵称/删除后，管理端仍能还原被举报时的内容（当前标题只作跳转与兜底）
  @ApiProperty({ type: String, description: '举报时的目标快照（文章标题+简介 / 用户昵称）', required: false })
  @Column({ type: 'varchar', name: 'target_snapshot', length: 500, nullable: true, comment: '举报时的目标快照（文章标题+简介 / 用户昵称）' })
  public targetSnapshot: string;

  @ApiProperty({ type: Number, description: '举报人用户ID' })
  @Column({ type: 'int', name: 'reporter_id', comment: '举报人用户ID' })
  public reporterId: number;

  @ApiProperty({ type: String, description: '举报理由（字典 post_report_reason 的 dictValue）' })
  @Column({ type: 'varchar', name: 'reason_type', length: 32, comment: '举报理由（字典 post_report_reason 的 dictValue）' })
  public reasonType: string;

  @ApiProperty({ type: String, description: '补充说明', required: false })
  @Column({ type: 'varchar', name: 'reason_content', length: 500, nullable: true, comment: '补充说明（可空，抄袭出处等）' })
  public reasonContent: string;

  @ApiProperty({ type: String, description: '处理状态（0 待处理 1 成立 2 驳回）' })
  @Column({ type: 'char', name: 'status', length: 1, default: '0', comment: '处理状态（0 待处理 1 成立 2 驳回）' })
  public status: string;

  @ApiProperty({ type: String, description: '处置动作', required: false })
  @Column({ type: 'varchar', name: 'handle_action', length: 16, nullable: true, comment: '处置动作（unpublish 下架文章 / disableUser 停用用户，无动作 null）' })
  public handleAction: string;

  @ApiProperty({ type: String, description: '处理备注', required: false })
  @Column({ type: 'varchar', name: 'handle_remark', length: 255, nullable: true, comment: '处理备注' })
  public handleRemark: string;

  @ApiProperty({ type: Number, description: '处理人用户ID', required: false })
  @Column({ type: 'int', name: 'handler_id', nullable: true, comment: '处理人用户ID' })
  public handlerId: number;

  @ApiProperty({ type: Number, description: '待处理标记', required: false })
  // 待处理=1、处理完成置 NULL：MySQL 唯一索引对含 NULL 的行不查重，与 (reporter, target) 组成
  // uk_reporter_pending 即「同一目标同时至多一条待处理举报」——处理完可再次举报，历史多行共存
  @Column({ type: 'int', name: 'pending_flag', nullable: true, comment: '待处理标记（待处理=1，处理完成置 NULL）' })
  public pendingFlag: number | null;

  @ApiProperty({ type: Date, description: '处理时间', required: false })
  // precision 3 → datetime(3) 毫秒粒度：此列为举报反馈通知未读水位比较列（handle_time > read_time），
  // 秒级粒度会使 markRead 同秒处理完的举报被严格 > 永久排除（同互动表 create_time 口径）
  @Column({ type: 'datetime', precision: 3, name: 'handle_time', nullable: true, comment: '处理时间（毫秒粒度，举报反馈水位比较列）' })
  public handleTime: Date;

  @ApiProperty({ type: Date, description: '举报时间' })
  // precision 3 → datetime(3) 毫秒粒度（同 post_follow.create_time 口径）
  @CreateDateColumn({ type: 'datetime', precision: 3, name: 'create_time', comment: '举报时间（毫秒粒度，24h 频控统计列）' })
  public createTime: Date;
}
