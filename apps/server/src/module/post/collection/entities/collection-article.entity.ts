import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 收藏集文章关联实体类
 * 对应数据库表：post_collection_article
 * 一集一文只能有一条收藏记录（uk_collection_article 唯一索引），移出物理删除；
 * user_id 即收藏集创建者（只有创建者能往自己的收藏集收录文章），冗余便于按人聚合统计
 */
@Entity('post_collection_article', { comment: '收藏集文章关联库' })
@Index('uk_collection_article', ['collectionId', 'articleId'], { unique: true })
export class PostCollectionArticleEntity {
  @ApiProperty({ type: Number, description: '收藏记录 id' })
  @PrimaryGeneratedColumn({ name: 'id', comment: '收藏记录 id' })
  public id: number;

  @ApiProperty({ type: Number, description: '收藏集 id' })
  @Column({ type: 'int', name: 'collection_id', comment: '收藏集 id' })
  public collectionId: number;

  @ApiProperty({ type: Number, description: '文章 id' })
  @Column({ type: 'int', name: 'article_id', comment: '文章 id' })
  public articleId: number;

  @ApiProperty({ type: Number, description: '收藏人用户ID（即收藏集创建者）' })
  @Column({ type: 'int', name: 'user_id', comment: '收藏人用户ID（即收藏集创建者）' })
  public userId: number;

  @ApiProperty({ type: Date, description: '收藏时间' })
  // precision 3 → datetime(3) 毫秒粒度：此列为互动通知未读水位比较列（create_time > read_time），
  // 秒级粒度会使 markRead 同秒互动被严格 > 永久排除
  @CreateDateColumn({ type: 'datetime', precision: 3, name: 'create_time', comment: '收藏时间' })
  public createTime: Date;
}
