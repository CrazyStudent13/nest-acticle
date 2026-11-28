import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ResultData } from 'src/common/utils/result';
import { applyLike } from 'src/common/query';
import { SysNoticeEntity } from './entities/notice.entity';
import { NOTICE_READ_PREFIX, PostNotifyReadEntity } from 'src/module/post/notify/entities/notify-read.entity';
import { CreateNoticeDto, UpdateNoticeDto, ListNoticeDto } from './dto/index';

@Injectable()
export class NoticeService {
  constructor(
    @InjectRepository(SysNoticeEntity)
    private readonly sysNoticeEntityRep: Repository<SysNoticeEntity>,
    @InjectRepository(PostNotifyReadEntity)
    private readonly notifyReadRepo: Repository<PostNotifyReadEntity>,
  ) {}
  async create(createNoticeDto: CreateNoticeDto) {
    await this.sysNoticeEntityRep.save(createNoticeDto);
    return ResultData.ok();
  }

  async findAll(query: ListNoticeDto, viewerId?: number, isManager = false) {
    const entity = this.sysNoticeEntityRep.createQueryBuilder('entity');
    entity.where('entity.delFlag = :delFlag', { delFlag: '0' });

    applyLike(entity, 'entity.noticeTitle', query.noticeTitle);
    applyLike(entity, 'entity.createBy', query.createBy);

    // 定向可见性：scope=mine（前台通知中心）或按 noticeId 直取详情时，只回「全员公告 + 发给我的定向通知」，
    // 私密通知不能越权可见；管理端列表（isManager=true，无 scope）不过滤，便于管理全部定向通知
    const scoped = query.scope === 'mine' || !!query.noticeId;
    if (scoped && viewerId) {
      entity.andWhere('(entity.userId IS NULL OR entity.userId = :viewerId)', { viewerId });
    } else if (!isManager) {
      // 服务端可见性闸门：仅持 system:notice:list 的前台角色（member）不带 scope 拉列表时，
      // 同样只回「全员公告 + 发给我的定向通知」——不能凭缺省 scope 读到全部用户的定向通知（越权读修复）；
      // isManager 由 controller 按 system:notice:query/通配判定后传入
      if (viewerId) {
        entity.andWhere('(entity.userId IS NULL OR entity.userId = :viewerId)', { viewerId });
      } else {
        entity.andWhere('entity.userId IS NULL');
      }
    }

    if (query.noticeId) {
      // 前台通知详情页按 id 直取（复用 list 权限，见 ListNoticeDto 注释）：服务端强制只回生效公告，
      // 关闭态公告不能凭 id 越权直取；管理端列表不带 noticeId 走不到此分支，过滤逻辑不变
      entity.andWhere('entity.noticeId = :noticeId', { noticeId: query.noticeId });
      entity.andWhere('entity.status = :status', { status: '0' });
    }

    if (query.noticeType) {
      entity.andWhere('entity.noticeType = :noticeType', { noticeType: query.noticeType });
    }

    if (query.status) {
      entity.andWhere('entity.status = :status', { status: query.status });
    }

    if (query.params?.beginTime && query.params?.endTime) {
      entity.andWhere('entity.createTime BETWEEN :start AND :end', { start: query.params.beginTime, end: query.params.endTime });
    }

    entity.skip(query.pageSize * (query.pageNum - 1)).take(query.pageSize);
    const [list, total] = await entity.getManyAndCount();

    // scope=mine（前台通知中心）附行级 unread 标记：查本页通知在该用户下的逐条已读标记
    // （post_notify_read category='n:<noticeId>'，与 PostNotifyService 的未读口径同源），
    // 管理端列表（无 scope）不附——管理视角没有「未读」概念
    if (query.scope === 'mine' && viewerId && list.length) {
      const readMarks = await this.notifyReadRepo.find({
        where: {
          userId: viewerId,
          category: In(list.map((notice) => `${NOTICE_READ_PREFIX}${notice.noticeId}`)),
        },
        select: ['category'],
      });
      const readSet = new Set(readMarks.map((row) => Number(row.category.slice(NOTICE_READ_PREFIX.length))));
      for (const notice of list) {
        (notice as SysNoticeEntity & { unread: boolean }).unread = !readSet.has(notice.noticeId);
      }
    }

    return ResultData.ok({
      list,
      total,
    });
  }

  async findOne(noticeId: number) {
    const data = await this.sysNoticeEntityRep.findOne({
      where: {
        noticeId: noticeId,
      },
    });
    return ResultData.ok(data);
  }

  async update(updateNoticeDto: UpdateNoticeDto) {
    await this.sysNoticeEntityRep.update(
      {
        noticeId: updateNoticeDto.noticeId,
      },
      updateNoticeDto,
    );
    return ResultData.ok();
  }

  async remove(noticeIds: number[]) {
    const data = await this.sysNoticeEntityRep.update(
      { noticeId: In(noticeIds) },
      {
        delFlag: '1',
      },
    );
    return ResultData.ok(data);
  }
}
