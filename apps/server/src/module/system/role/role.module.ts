import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleService } from './role.service';
import { RoleController } from './role.controller';
import { SysRoleEntity } from './entities/role.entity';
import { SysRoleWithMenuEntity } from './entities/role-width-menu.entity';
import { MenuModule } from '../menu/menu.module';
import { UserEntity } from '../user/entities/sys-user.entity';
import { SysUserWithRoleEntity } from '../user/entities/user-width-role.entity';
import { RedisModule } from 'src/module/common/redis/redis.module';

@Module({
  imports: [
    // UserEntity/SysUserWithRoleEntity：角色↔用户绑定端点的查询写入在本模块（role.service），
    // forFeature 声明式注册跨模块实体，避免 RoleModule→UserModule 反向依赖成环
    TypeOrmModule.forFeature([SysRoleEntity, SysRoleWithMenuEntity, UserEntity, SysUserWithRoleEntity]),
    // 显式依赖（@Global 拆除后）：MenuService / RedisService
    MenuModule,
    RedisModule,
  ],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService],
})
export class RoleModule {}
