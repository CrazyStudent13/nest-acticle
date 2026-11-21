import { Module } from '@nestjs/common';
import { PostArticleModule } from './article/article.module';
import { PostSubjectModule } from './subject/subject.module';
import { PostLikeModule } from './like/like.module';
import { PostCommentModule } from './comment/comment.module';

/**
 * Post 模块（文章、专栏、点赞和评论）
 */
@Module({
  imports: [PostArticleModule, PostSubjectModule, PostLikeModule, PostCommentModule],
  exports: [PostArticleModule, PostSubjectModule, PostLikeModule, PostCommentModule],
})
export class PostModule {}
