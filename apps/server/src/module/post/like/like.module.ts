import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostLikeService } from './like.service';
import { PostLikeController } from './like.controller';
import { PostLikeEntity } from './entities/like.entity';

/**
 * 点赞模块（文章实体的仓储由全局的 PostArticleModule 提供）
 */
@Module({
  imports: [TypeOrmModule.forFeature([PostLikeEntity])],
  controllers: [PostLikeController],
  providers: [PostLikeService],
  exports: [PostLikeService],
})
export class PostLikeModule {}
