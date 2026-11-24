import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 通知已读水位实体类
 * 对应数据库表：post_notify_read
 * 每用户每分类一行（联合主键），记录该分类「最后已读时刻」——未读数 = 互动记录
 * create_time 晚于水位的条数，不逐条打已读标记；进入通知中心时把水位推至当前。
 * read_time 与互动表 create_time 均为 datetime(3) 毫秒粒度：秒级粒度下 markRead
 * 同秒到达的互动 create_time 等于水位、被严格 > 永久排除（漏红标）；毫秒级后残余
 * 窗口缩至同毫秒并发，属存储粒度极限
 */
@Entity('post_notify_read', { comment: '通知已读水位库' })
export class PostNotifyReadEntity {
  @ApiProperty({ type: Number, description: '用户 id' })
  @PrimaryColumn({ type: 'int', name: 'user_id', comment: '用户 id' })
  public userId: number;

  @ApiProperty({ type: String, description: '通知分类（comment 评论 / like 点赞）' })
  @PrimaryColumn({ type: 'varchar', name: 'category', length: 16, comment: '通知分类（comment 评论 / like 点赞）' })
  public category: string;

  @ApiProperty({ type: Date, description: '最后已读时间' })
  // precision 3 → datetime(3) 毫秒粒度（TypeORM MySQL 支持 precision 的类型含 datetime）
  @CreateDateColumn({ type: 'datetime', precision: 3, name: 'read_time', comment: '最后已读时间' })
  public readTime: Date;
}
