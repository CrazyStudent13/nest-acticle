import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { AuthStrategy } from './auth.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserEntity } from '../user/entities/sys-user.entity';
import { UserModule } from '../user/user.module';
import { MenuModule } from '../menu/menu.module';
import { SysConfigModule } from '../config/config.module';
import { LoginlogModule } from 'src/module/monitor/loginlog/loginlog.module';
import { RedisModule } from 'src/module/common/redis/redis.module';
import { CommonModule } from 'src/module/common/common.module';
import { AxiosModule } from 'src/module/common/axios/axios.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        secret: config.get('jwt.secretkey'),
      }),
      inject: [ConfigService],
    }),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    // 显式依赖（@Global 拆除后）：RedisService / MailService / AxiosService / 系统配置 / 用户 / 菜单 / 登录日志
    RedisModule,
    CommonModule,
    AxiosModule,
    SysConfigModule,
    UserModule,
    MenuModule,
    LoginlogModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthStrategy],
  exports: [AuthService, PassportModule],
})
export class AuthModule {}
