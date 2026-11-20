import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DictService } from './dict.service';
import { DictController } from './dict.controller';
import { SysDictTypeEntity } from './entities/dict.type.entity';
import { SysDictDataEntity } from './entities/dict.data.entity';
import { RedisModule } from 'src/module/common/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SysDictTypeEntity, SysDictDataEntity]),
    // 显式依赖（@Global 拆除后）：RedisService（字典缓存）
    RedisModule,
  ],
  controllers: [DictController],
  providers: [DictService],
})
export class DictModule {}
