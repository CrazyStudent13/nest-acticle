import { Module } from '@nestjs/common';
import { PostArticleModule } from './article/article.module';
import { PostSubjectModule } from './subject/subject.module';
import { PostLikeModule } from './like/like.module';

/**
 * Post 模块（文章、专栏和点赞）
 */
@Module({
  imports: [PostArticleModule, PostSubjectModule, PostLikeModule],
  exports: [PostArticleModule, PostSubjectModule, PostLikeModule],
})
export class PostModule {}
