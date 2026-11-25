import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 关注实体类
 * 对应数据库表：post_follow
 * 一人一人只能有一条关注记录（uk_follower_following 唯一索引），取关物理删除；
 * fan_num/follow_num 不落冗余计数列，展示侧读时 COUNT（follower_id/following_id 两方向索引）
 */
@Entity('post_follow', { comment: '关注库' })
@Index('uk_follower_following', ['followerId', 'followingId'], { unique: true })
@Index('idx_following_id', ['followingId'])
export class PostFollowEntity {
  @ApiProperty({ type: Number, description: '关注 id' })
  @PrimaryGeneratedColumn({ name: 'id', comment: '关注 id' })
  public id: number;

  @ApiProperty({ type: Number, description: '关注人（粉丝）用户ID' })
  @Column({ type: 'int', name: 'follower_id', comment: '关注人（粉丝）用户ID' })
  public followerId: number;

  @ApiProperty({ type: Number, description: '被关注用户ID' })
  @Column({ type: 'int', name: 'following_id', comment: '被关注用户ID' })
  public followingId: number;

  @ApiProperty({ type: Date, description: '关注时间' })
  // precision 3 → datetime(3) 毫秒粒度：此列为互动通知未读水位比较列（create_time > read_time），
  // 秒级粒度会使 markRead 同秒互动被严格 > 永久排除（同 like/comment 口径）
  @CreateDateColumn({ type: 'datetime', precision: 3, name: 'create_time', comment: '关注时间' })
  public createTime: Date;
}
