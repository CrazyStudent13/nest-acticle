import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostCommentService } from './comment.service';
import { PostCommentController } from './comment.controller';
import { PostCommentEntity } from './entities/comment.entity';
import { PostArticleEntity } from '../article/entities/article.entity';

/**
 * 评论模块
 * forFeature 需同时注册 PostArticleEntity——forFeature 仓储不随 @Global 传递，
 * PostCommentService 的事务与计数都依赖文章仓储
 */
@Module({
  imports: [TypeOrmModule.forFeature([PostCommentEntity, PostArticleEntity])],
  controllers: [PostCommentController],
  providers: [PostCommentService],
  exports: [PostCommentService],
})
export class PostCommentModule {}
