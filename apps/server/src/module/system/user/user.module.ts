import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { UserExcelService } from './user-excel.service';
import { UserController } from './user.controller';
import { UserEntity } from './entities/sys-user.entity';
import { SysUserWithRoleEntity } from './entities/user-width-role.entity';
import { SysRoleEntity } from '../role/entities/role.entity';
import { RoleModule } from '../role/role.module';
import { RedisModule } from 'src/module/common/redis/redis.module';
import { UploadModule } from 'src/module/upload/upload.module';
import { OperlogModule } from 'src/module/monitor/operlog/operlog.module';
import { PostFollowModule } from 'src/module/post/follow/follow.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, SysRoleEntity, SysUserWithRoleEntity]),
    // 显式依赖（@Global 拆除后）：RoleService / RedisService / 头像上传 / @Operlog 拦截器所需的 OperlogService
    RoleModule,
    RedisModule,
    UploadModule,
    OperlogModule,
    // 用户列表「粉丝量」列：复用关注服务的整页 GROUP BY 批查（post_follow 表访问逻辑收口在 post/follow 模块内）
    PostFollowModule,
  ],
  controllers: [UserController],
  providers: [UserService, UserExcelService],
  exports: [UserService, UserExcelService],
})
export class UserModule {}
