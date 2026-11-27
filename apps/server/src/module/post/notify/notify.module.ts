import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostNotifyController } from './notify.controller';
import { PostNotifyService } from './notify.service';
import { PostNotifyReadEntity } from './entities/notify-read.entity';
import { PostCommentEntity } from '../comment/entities/comment.entity';
import { PostLikeEntity } from '../like/entities/like.entity';
import { PostCollectionArticleEntity } from '../collection/entities/collection-article.entity';
import { PostCollectionEntity } from '../collection/entities/collection.entity';
import { PostArticleEntity } from '../article/entities/article.entity';
import { PostFollowEntity } from '../follow/entities/follow.entity';
import { SysNoticeEntity } from 'src/module/system/notice/entities/notice.entity';

/**
 * 互动通知模块
 * forFeature 需同时注册评论/点赞/收藏关联/收藏集/文章/关注/系统通知实体——未读计数跨表联查，
 * forFeature 仓储不随 @Global 传递（同点赞模块的注册口径）
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PostNotifyReadEntity,
      PostCommentEntity,
      PostLikeEntity,
      PostCollectionArticleEntity,
      PostCollectionEntity,
      PostArticleEntity,
      PostFollowEntity,
      SysNoticeEntity,
    ]),
  ],
  controllers: [PostNotifyController],
  providers: [PostNotifyService],
  exports: [PostNotifyService],
})
export class PostNotifyModule {}
