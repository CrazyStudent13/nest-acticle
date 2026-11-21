import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperlogService } from './operlog.service';
import { OperlogController } from './operlog.controller';
import { SysOperlogEntity } from './entities/operlog.entity';
import { AxiosModule } from 'src/module/common/axios/axios.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([SysOperlogEntity]),
    // 显式依赖（@Global 拆除后）：AxiosService（IP 归属地查询）
    AxiosModule,
  ],
  controllers: [OperlogController],
  providers: [OperlogService],
  exports: [OperlogService],
})
export class OperlogModule {}
