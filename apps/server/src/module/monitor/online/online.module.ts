import { Module } from '@nestjs/common';
import { OnlineService } from './online.service';
import { OnlineController } from './online.controller';
import { RedisModule } from 'src/module/common/redis/redis.module';

@Module({
  // 显式依赖（@Global 拆除后）：RedisService（在线用户读取会话键）
  imports: [RedisModule],
  controllers: [OnlineController],
  providers: [OnlineService],
})
export class OnlineModule {}
