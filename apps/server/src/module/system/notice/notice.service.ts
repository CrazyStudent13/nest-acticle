import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ResultData } from 'src/common/utils/result';
import { applyLike } from 'src/common/query';
import { SysNoticeEntity } from './entities/notice.entity';
import { CreateNoticeDto, UpdateNoticeDto, ListNoticeDto } from './dto/index';

@Injectable()
export class NoticeService {
  constructor(
    @InjectRepository(SysNoticeEntity)
    private readonly sysNoticeEntityRep: Repository<SysNoticeEntity>,
  ) {}
  async create(createNoticeDto: CreateNoticeDto) {
    await this.sysNoticeEntityRep.save(createNoticeDto);
    return ResultData.ok();
  }

  async findAll(query: ListNoticeDto) {
    const entity = this.sysNoticeEntityRep.createQueryBuilder('entity');
    entity.where('entity.delFlag = :delFlag', { delFlag: '0' });

    applyLike(entity, 'entity.noticeTitle', query.noticeTitle);
    applyLike(entity, 'entity.createBy', query.createBy);

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
