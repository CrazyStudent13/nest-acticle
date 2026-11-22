import { Module } from '@nestjs/common';
import { PostArticleModule } from './article/article.module';
import { PostSubjectModule } from './subject/subject.module';
import { PostLikeModule } from './like/like.module';
import { PostCommentModule } from './comment/comment.module';
import { PostNotifyModule } from './notify/notify.module';
import { PostCollectionModule } from './collection/collection.module';

/**
 * Post 模块（文章、专栏、点赞、评论、互动通知和收藏集）
 */
@Module({
  imports: [PostArticleModule, PostSubjectModule, PostLikeModule, PostCommentModule, PostNotifyModule, PostCollectionModule],
  exports: [PostArticleModule, PostSubjectModule, PostLikeModule, PostCommentModule, PostNotifyModule, PostCollectionModule],
})
export class PostModule {}
