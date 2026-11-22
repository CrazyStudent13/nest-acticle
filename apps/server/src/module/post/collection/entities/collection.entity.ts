import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { DeleteStatusEntity } from 'src/common/entities/base';

/**
 * 收藏集实体类
 * 对应数据库表：post_collection
 * 用户创建的收藏夹，收录已发布文章；visibility 控制公开（可订阅）/私密（仅创建者可见）
 */
@Entity('post_collection', { comment: '收藏集库' })
@Index('idx_user_id', ['userId'])
export class PostCollectionEntity extends DeleteStatusEntity {
  @ApiProperty({ type: Number, description: '收藏集 id' })
  @PrimaryGeneratedColumn({ name: 'id', comment: '收藏集 id' })
  public id: number;

  @ApiProperty({ type: Number, description: '创建者用户ID' })
  @Column({ type: 'int', name: 'user_id', comment: '创建者用户ID' })
  public userId: number;

  @ApiProperty({ type: String, description: '收藏集名称' })
  @Column({ type: 'varchar', name: 'name', length: 32, comment: '收藏集名称' })
  public name: string;

  @ApiProperty({ type: String, description: '收藏集简介', required: false })
  @Column({ type: 'varchar', name: 'desc', length: 255, nullable: true, comment: '收藏集简介' })
  public desc: string;

  @ApiProperty({ type: String, description: '可见性（0 公开 1 私密）' })
  @Column({ type: 'char', name: 'visibility', length: 1, default: '0', comment: '可见性（0 公开 1 私密）' })
  public visibility: string;

  @ApiProperty({ type: Number, description: '收录文章数量' })
  @Column({ type: 'int', name: 'article_count', default: 0, comment: '收录文章数量' })
  public articleCount: number;

  @ApiProperty({ type: Number, description: '订阅人数' })
  @Column({ type: 'int', name: 'subscriber_count', default: 0, comment: '订阅人数' })
  public subscriberCount: number;

  @ApiProperty({ type: Date, description: '创建时间' })
  @CreateDateColumn({ type: 'datetime', name: 'create_time', comment: '创建时间' })
  public createTime: Date;

  @ApiProperty({ type: Date, description: '更新时间' })
  @UpdateDateColumn({ type: 'datetime', name: 'update_time', comment: '更新时间' })
  public updateTime: Date;
}
