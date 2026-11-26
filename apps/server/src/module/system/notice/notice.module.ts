import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NoticeService } from './notice.service';
import { NoticeController } from './notice.controller';
import { SysNoticeEntity } from './entities/notice.entity';
import { PostNotifyReadEntity } from 'src/module/post/notify/entities/notify-read.entity';

/**
 * 通知公告模块
 * PostNotifyReadEntity 经 forFeature 注册（scope=mine 列表附行级未读标记，逐条已读口径）
 */
@Module({
  imports: [TypeOrmModule.forFeature([SysNoticeEntity, PostNotifyReadEntity])],
  controllers: [NoticeController],
  providers: [NoticeService],
})
export class NoticeModule {}
