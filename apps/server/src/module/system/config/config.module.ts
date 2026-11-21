import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from './config.service';
import { ConfigController } from './config.controller';
import { SysConfigEntity } from './entities/config.entity';
import { RedisModule } from 'src/module/common/redis/redis.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([SysConfigEntity]),
    // 显式依赖（@Global 拆除后）：RedisService（配置缓存）
    RedisModule,
  ],
  controllers: [ConfigController],
  providers: [ConfigService],
  exports: [ConfigService],
})
export class SysConfigModule {}
