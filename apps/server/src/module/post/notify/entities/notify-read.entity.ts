import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 通知已读水位实体类
 * 对应数据库表：post_notify_read
 * 每用户每分类一行（联合主键），记录该分类「最后已读时刻」——未读数 = 互动记录
 * create_time 晚于水位的条数，不逐条打已读标记；进入通知中心时把水位推至当前
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
  @CreateDateColumn({ type: 'datetime', name: 'read_time', comment: '最后已读时间' })
  public readTime: Date;
}
