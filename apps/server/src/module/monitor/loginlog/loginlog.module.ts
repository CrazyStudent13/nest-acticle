import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoginlogService } from './loginlog.service';
import { LoginlogController } from './loginlog.controller';
import { MonitorLoginlogEntity } from './entities/loginlog.entity';
@Module({
  imports: [TypeOrmModule.forFeature([MonitorLoginlogEntity])],
  controllers: [LoginlogController],
  providers: [LoginlogService],
  exports: [LoginlogService],
})
export class LoginlogModule {}
