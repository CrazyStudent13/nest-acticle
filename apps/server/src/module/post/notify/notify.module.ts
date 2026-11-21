import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostNotifyController } from './notify.controller';
import { PostNotifyService } from './notify.service';
import { PostNotifyReadEntity } from './entities/notify-read.entity';
import { PostCommentEntity } from '../comment/entities/comment.entity';
import { PostLikeEntity } from '../like/entities/like.entity';
import { PostArticleEntity } from '../article/entities/article.entity';

/**
 * 互动通知模块
 * forFeature 需同时注册评论/点赞/文章实体——未读计数跨三表联查，
 * forFeature 仓储不随 @Global 传递（同点赞模块的注册口径）
 */
@Module({
  imports: [TypeOrmModule.forFeature([PostNotifyReadEntity, PostCommentEntity, PostLikeEntity, PostArticleEntity])],
  controllers: [PostNotifyController],
  providers: [PostNotifyService],
  exports: [PostNotifyService],
})
export class PostNotifyModule {}
