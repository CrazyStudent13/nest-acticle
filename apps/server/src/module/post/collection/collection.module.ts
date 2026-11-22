import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostCollectionEntity } from './entities/collection.entity';
import { PostCollectionArticleEntity } from './entities/collection-article.entity';
import { PostCollectionSubEntity } from './entities/collection-sub.entity';
import { PostArticleEntity } from '../article/entities/article.entity';
import { PostCollectionController } from './collection.controller';
import { PostCollectionService } from './collection.service';

/**
 * 收藏集模块（收藏集 CRUD、收藏/移出、订阅/退订、收到的收藏）
 */
@Module({
  imports: [TypeOrmModule.forFeature([PostCollectionEntity, PostCollectionArticleEntity, PostCollectionSubEntity, PostArticleEntity])],
  controllers: [PostCollectionController],
  providers: [PostCollectionService],
  exports: [PostCollectionService],
})
export class PostCollectionModule {}
