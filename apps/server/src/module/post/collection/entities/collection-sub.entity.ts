import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 收藏集订阅实体类
 * 对应数据库表：post_collection_sub
 * 一集一人只能有一条订阅记录（uk_collection_user 唯一索引），退订物理删除；
 * 仅公开收藏集可被订阅，私密集不产生订阅关系
 */
@Entity('post_collection_sub', { comment: '收藏集订阅库' })
@Index('uk_collection_user', ['collectionId', 'userId'], { unique: true })
export class PostCollectionSubEntity {
  @ApiProperty({ type: Number, description: '订阅记录 id' })
  @PrimaryGeneratedColumn({ name: 'id', comment: '订阅记录 id' })
  public id: number;

  @ApiProperty({ type: Number, description: '收藏集 id' })
  @Column({ type: 'int', name: 'collection_id', comment: '收藏集 id' })
  public collectionId: number;

  @ApiProperty({ type: Number, description: '订阅用户ID' })
  @Column({ type: 'int', name: 'user_id', comment: '订阅用户ID' })
  public userId: number;

  @ApiProperty({ type: Date, description: '订阅时间' })
  @CreateDateColumn({ type: 'datetime', name: 'create_time', comment: '订阅时间' })
  public createTime: Date;
}
