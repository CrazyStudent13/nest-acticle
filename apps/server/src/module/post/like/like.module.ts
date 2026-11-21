import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostLikeService } from './like.service';
import { PostLikeController } from './like.controller';
import { PostLikeEntity } from './entities/like.entity';
import { PostArticleEntity } from '../article/entities/article.entity';

/**
 * 点赞模块
 * forFeature 需同时注册 PostArticleEntity——forFeature 仓储不随 @Global 传递，
 * PostLikeService 的事务与计数都依赖文章仓储
 */
@Module({
  imports: [TypeOrmModule.forFeature([PostLikeEntity, PostArticleEntity])],
  controllers: [PostLikeController],
  providers: [PostLikeService],
  exports: [PostLikeService],
})
export class PostLikeModule {}
