import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostFollowService } from './follow.service';
import { PostFollowController } from './follow.controller';
import { PostFollowEntity } from './entities/follow.entity';
import { UserEntity } from 'src/module/system/user/entities/sys-user.entity';

/**
 * 关注模块
 * forFeature 需同时注册 UserEntity——关注目标存在性校验与列表联查都依赖用户仓储，
 * forFeature 仓储不随 @Global 传递（同点赞模块的注册口径）
 */
@Module({
  imports: [TypeOrmModule.forFeature([PostFollowEntity, UserEntity])],
  controllers: [PostFollowController],
  providers: [PostFollowService],
  exports: [PostFollowService],
})
export class PostFollowModule {}
