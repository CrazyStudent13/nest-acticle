import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheController } from './cache.controller';
import { RedisModule } from 'src/module/common/redis/redis.module';

@Module({
  // 显式依赖（@Global 拆除后）：RedisService（缓存监控直接扫 Redis）
  imports: [RedisModule],
  controllers: [CacheController],
  providers: [CacheService],
})
export class CacheModule {}
