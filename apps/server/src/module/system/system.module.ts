import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { SysConfigModule } from './config/config.module';
import { DictModule } from './dict/dict.module';
import { MenuModule } from './menu/menu.module';
import { NoticeModule } from './notice/notice.module';
import { RoleModule } from './role/role.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    AuthModule,
    SysConfigModule, // 系统配置
    DictModule,
    MenuModule,
    NoticeModule,
    RoleModule,
    UserModule,
  ],
})
export class SystemModule {}
