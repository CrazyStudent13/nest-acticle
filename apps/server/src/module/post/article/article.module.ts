import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostArticleService } from './article.service';
import { PostArticleController } from './article.controller';
import { PostArticleEntity } from './entities/article.entity';

import { UserEntity } from 'src/module/system/user/entities/sys-user.entity';
import { PostReportEntity } from '../report/entities/report.entity';
import { PostFollowEntity } from '../follow/entities/follow.entity';
import { RedisModule } from 'src/module/common/redis/redis.module';

/**
 * 文章模块
 * UserEntity 经 forFeature 声明式注册（作者信息回填查询），不 import UserModule
 * PostReportEntity 经 forFeature 注册（作者自行恢复发布时校验是否存在成立的举报下架记录）
 * PostFollowEntity 经 forFeature 注册（关注 feed 的 inner join 目标）
 * RedisModule 显式依赖：RedisService 用于阅读上报防刷去重
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PostArticleEntity, UserEntity, PostReportEntity, PostFollowEntity]),
    RedisModule,
  ],
  controllers: [PostArticleController],
  providers: [PostArticleService],
  exports: [PostArticleService],
})
export class PostArticleModule {}
