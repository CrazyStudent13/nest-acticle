import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostReportService } from './report.service';
import { PostReportController } from './report.controller';
import { PostReportEntity } from './entities/report.entity';
import { PostArticleEntity } from '../article/entities/article.entity';
import { UserEntity } from 'src/module/system/user/entities/sys-user.entity';
import { DictModule } from 'src/module/system/dict/dict.module';
import { UserModule } from 'src/module/system/user/user.module';

/**
 * 举报模块
 * forFeature 需同时注册文章/用户实体——目标存在性校验、处置动作（下架/停用）与目标摘要批查都依赖，
 * forFeature 仓储不随 @Global 传递（同点赞/关注模块的注册口径）
 * 显式依赖：DictModule（理由/目标类型合法性走字典缓存校验）、UserModule（停用动作复用会话清理 kickUserSessions，
 * system→post 方向已有 UserModule→PostFollowModule 先例，此处反向依赖不成环）
 */
@Module({
  imports: [TypeOrmModule.forFeature([PostReportEntity, PostArticleEntity, UserEntity]), DictModule, UserModule],
  controllers: [PostReportController],
  providers: [PostReportService],
  exports: [PostReportService],
})
export class PostReportModule {}
