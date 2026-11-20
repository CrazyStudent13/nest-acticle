import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { SysMenuEntity } from './entities/menu.entity';
import { SysRoleWithMenuEntity } from '../role/entities/role-width-menu.entity';
import { SysUserWithRoleEntity } from '../user/entities/user-width-role.entity';
import { RedisModule } from 'src/module/common/redis/redis.module';

@Module({
  imports: [
    // SysUserWithRoleEntity：getMenuListByUserId 需查用户角色关联，
    // forFeature 声明式注册跨模块实体，避免 MenuModule→UserModule 反向依赖成环（User→Role→Menu）
    TypeOrmModule.forFeature([SysMenuEntity, SysRoleWithMenuEntity, SysUserWithRoleEntity]),
    // 显式依赖（@Global 拆除后）：RedisService
    RedisModule,
  ],
  controllers: [MenuController],
  providers: [MenuService],
  exports: [MenuService],
})
export class MenuModule {}
