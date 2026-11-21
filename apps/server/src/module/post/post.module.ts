import { Module } from '@nestjs/common';
import { PostArticleModule } from './article/article.module';
import { PostSubjectModule } from './subject/subject.module';
import { PostLikeModule } from './like/like.module';
import { PostCommentModule } from './comment/comment.module';
import { PostNotifyModule } from './notify/notify.module';

/**
 * Post 模块（文章、专栏、点赞、评论和互动通知）
 */
@Module({
  imports: [PostArticleModule, PostSubjectModule, PostLikeModule, PostCommentModule, PostNotifyModule],
  exports: [PostArticleModule, PostSubjectModule, PostLikeModule, PostCommentModule, PostNotifyModule],
})
export class PostModule {}
