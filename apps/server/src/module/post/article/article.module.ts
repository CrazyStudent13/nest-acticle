import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostArticleService } from './article.service';
import { PostArticleController } from './article.controller';
import { PostArticleEntity } from './entities/article.entity';

import { UserEntity } from 'src/module/system/user/entities/sys-user.entity';
import { RedisModule } from 'src/module/common/redis/redis.module';

/**
 * 文章模块
 * UserEntity 经 forFeature 声明式注册（作者信息回填查询），不 import UserModule
 * RedisModule 显式依赖：RedisService 用于阅读上报防刷去重
 */
@Module({
  imports: [TypeOrmModule.forFeature([PostArticleEntity, UserEntity]), RedisModule],
  controllers: [PostArticleController],
  providers: [PostArticleService],
  exports: [PostArticleService],
})
export class PostArticleModule {}
