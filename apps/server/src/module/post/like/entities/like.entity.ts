import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 点赞实体类
 * 对应数据库表：post_like
 * 一人一文只能有一条点赞记录（uk_article_user 唯一索引），取消点赞物理删除
 */
@Entity('post_like', { comment: '点赞库' })
@Index('uk_article_user', ['articleId', 'userId'], { unique: true })
export class PostLikeEntity {
  @ApiProperty({ type: Number, description: '点赞 id' })
  @PrimaryGeneratedColumn({ name: 'id', comment: '点赞 id' })
  public id: number;

  @ApiProperty({ type: Number, description: '文章 id' })
  @Column({ type: 'int', name: 'article_id', comment: '文章 id' })
  public articleId: number;

  @ApiProperty({ type: Number, description: '点赞用户ID' })
  @Column({ type: 'int', name: 'user_id', comment: '点赞用户ID' })
  public userId: number;

  @ApiProperty({ type: Date, description: '点赞时间' })
  @CreateDateColumn({ type: 'datetime', name: 'create_time', comment: '点赞时间' })
  public createTime: Date;
}
