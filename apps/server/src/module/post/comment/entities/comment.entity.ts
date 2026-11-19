import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 评论实体类
 * 对应数据库表：post_comment
 * 平铺一层展示（回复以 parent_id/reply_user_id 标记，无嵌套树）；删除为物理删除，
 * comment_num 计数在文章表冗余维护；删除带回复的评论时级联删除全部后代
 */
@Entity('post_comment', { comment: '评论库' })
@Index('idx_article_id', ['articleId'])
@Index('idx_user_id', ['userId'])
@Index('idx_parent_id', ['parentId'])
export class PostCommentEntity {
  @ApiProperty({ type: Number, description: '评论 id' })
  @PrimaryGeneratedColumn({ name: 'id', comment: '评论 id' })
  public id: number;

  @ApiProperty({ type: Number, description: '文章 id' })
  @Column({ type: 'int', name: 'article_id', comment: '文章 id' })
  public articleId: number;

  @ApiProperty({ type: Number, description: '评论用户ID' })
  @Column({ type: 'int', name: 'user_id', comment: '评论用户ID' })
  public userId: number;

  @ApiProperty({ type: String, description: '评论内容' })
  @Column({ type: 'varchar', name: 'content', length: 500, comment: '评论内容' })
  public content: string;

  @ApiProperty({ type: Number, description: '被回复的评论 id（根评论为 null）', nullable: true })
  @Column({ type: 'int', name: 'parent_id', nullable: true, comment: '被回复的评论 id' })
  public parentId: number;

  @ApiProperty({ type: Number, description: '被回复评论的作者用户 id', nullable: true })
  @Column({ type: 'int', name: 'reply_user_id', nullable: true, comment: '被回复评论的作者用户 id' })
  public replyUserId: number;

  @ApiProperty({ type: Date, description: '评论时间' })
  @CreateDateColumn({ type: 'datetime', name: 'create_time', comment: '评论时间' })
  public createTime: Date;
}
