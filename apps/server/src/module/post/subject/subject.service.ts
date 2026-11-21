import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ResultData } from 'src/common/utils/result';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { applyLike, paginate } from 'src/common/query';
import { PostSubjectEntity } from './entities/subject.entity';
import { PostArticleEntity } from '../article/entities/article.entity';
import { CreatePostSubjectDto, UpdatePostSubjectDto, ListPostSubjectDto, PublishStatusEnum } from './dto/index';
import { UserDto } from 'src/module/system/user/user.decorator';

@Injectable()
export class PostSubjectService {
  constructor(
    @InjectRepository(PostSubjectEntity)
    private readonly postSubjectRepository: Repository<PostSubjectEntity>,
    @InjectRepository(PostArticleEntity)
    private readonly postArticleRepository: Repository<PostArticleEntity>,
  ) {}

  async create(createDto: CreatePostSubjectDto, user: UserDto) {
    // 从当前登录用户信息中获取 userId
    const userId = user.user.userId;

    // 创建专栏实体，并设置 userId
    const subject = this.postSubjectRepository.create({
      ...createDto,
      userId: userId,
    });

    await this.postSubjectRepository.save(subject);
    return ResultData.ok();
  }

  async findAll(query: ListPostSubjectDto) {
    const entity = this.postSubjectRepository.createQueryBuilder('subject');
    entity.where('subject.delFlag = :delFlag', { delFlag: '0' });

    applyLike(entity, 'subject.title', query.title);

    if (query.userId) {
      entity.andWhere('subject.userId = :userId', { userId: query.userId });
    }

    if (query.publishStatus) {
      entity.andWhere('subject.publishStatus = :publishStatus', { publishStatus: query.publishStatus });
    }

    if (query.auditStatus) {
      entity.andWhere('subject.auditStatus = :auditStatus', { auditStatus: query.auditStatus });
    }

    if (query.orderByColumn && query.isAsc && this.isSubjectField(query.orderByColumn)) {
      const key = query.isAsc === 'ascending' ? 'ASC' : 'DESC';
      entity.orderBy(`subject.${query.orderByColumn}`, key);
    }

    paginate(entity, query);

    const [list, total] = await entity.getManyAndCount();

    // 批量统计各专栏文章数量（一次聚合查询替代逐专栏 count，未关联文章的专栏回填默认 0）
    const countMap = await this.countArticlesBySubjectMap(
      list.map((subject) => subject.id),
      false,
    );
    for (const subject of list) {
      subject.articleCount = countMap.get(subject.id) ?? 0;
    }

    return ResultData.ok({ list, total });
  }

  async findOne(id: number) {
    const subject = await this.postSubjectRepository.findOne({
      where: { id, delFlag: '0' },
    });

    if (!subject) {
      throw new BusinessException(500, '专栏不存在');
    }

    return ResultData.ok(subject);
  }

  /**
   * 校验字段是否为专栏实体的合法属性（防止 ORDER BY 注入）
   */
  private isSubjectField(field: string): boolean {
    return this.postSubjectRepository.metadata.columns.some((column) => column.propertyName === field);
  }

  /**
   * 批量统计多个专栏的文章数量：一次 GROUP BY subjectId 聚合查询替代逐专栏 count（消 N+1）
   * 计数口径与既有逐条 count 一致（delFlag = '0'；publishedOnly 时再限定已发布），
   * 未关联文章的专栏不在聚合结果中，由调用方按 Map 缺键回填默认 0（与既有逐条 count 返回 0 一致）
   * @param subjectIds 专栏 ID 列表
   * @param publishedOnly true 仅统计游客可见（已发布）文章 / false 统计全部未删除文章
   * @returns subjectId → 文章数量映射
   */
  private async countArticlesBySubjectMap(subjectIds: number[], publishedOnly: boolean): Promise<Map<number, number>> {
    const countMap = new Map<number, number>();
    if (subjectIds.length === 0) {
      return countMap;
    }

    const qb = this.postArticleRepository
      .createQueryBuilder('article')
      .select('article.subjectId', 'subjectId')
      .addSelect('COUNT(article.id)', 'articleCount')
      .where('article.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('article.subjectId IN (:...subjectIds)', { subjectIds });

    if (publishedOnly) {
      qb.andWhere('article.publishStatus = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED });
    }

    const rows = await qb.groupBy('article.subjectId').getRawMany();
    for (const row of rows) {
      // COUNT 经 Number 归一，与既有 count() 返回数值类型一致
      countMap.set(Number(row.subjectId), Number(row.articleCount));
    }
    return countMap;
  }

  /**
   * 统计专栏下游客可见（已发布）的文章数量
   */
  private async countGuestArticles(subjectId: number): Promise<number> {
    return this.postArticleRepository.count({
      where: { subjectId, delFlag: '0', publishStatus: PublishStatusEnum.PUBLISHED },
    });
  }

  /**
   * 查询专栏列表（游客，仅返回已发布专栏，不包含审核信息等内部数据）
   * @param query 查询参数
   * @returns 专栏列表和总数
   */
  async findGuestAll(query: ListPostSubjectDto) {
    const entity = this.postSubjectRepository.createQueryBuilder('subject');
    entity
      .select([
        'subject.id',
        'subject.title',
        'subject.desc',
        'subject.userId',
        'subject.cover',
        'subject.author',
        'subject.createTime',
      ])
      .where('subject.delFlag = :delFlag', { delFlag: '0' })
      .andWhere('subject.status = :status', { status: '0' })
      .andWhere('subject.publishStatus = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED });

    applyLike(entity, 'subject.title', query.title);

    if (query.userId) {
      entity.andWhere('subject.userId = :userId', { userId: query.userId });
    }

    // 排序（字段走实体属性校验，防止 ORDER BY 注入），默认按创建时间倒序
    if (query.orderByColumn && query.isAsc && this.isSubjectField(query.orderByColumn)) {
      const key = query.isAsc === 'ascending' ? 'ASC' : 'DESC';
      entity.orderBy(`subject.${query.orderByColumn}`, key);
    } else {
      entity.orderBy('subject.createTime', 'DESC');
    }

    paginate(entity, query);

    const [list, total] = await entity.getManyAndCount();

    // 批量统计各专栏游客可见（已发布）的文章数量（一次聚合查询替代逐专栏 count，未关联文章的专栏回填默认 0）
    const countMap = await this.countArticlesBySubjectMap(
      list.map((subject) => subject.id),
      true,
    );
    const processedList = list.map((subject) => ({
      ...subject,
      articleCount: countMap.get(subject.id) ?? 0,
    }));

    return ResultData.ok({ list: processedList, total });
  }

  /**
   * 查询专栏详情（游客，仅返回已发布专栏，不包含审核信息等内部数据）
   * @param id 专栏ID
   * @returns 专栏详情
   */
  async findGuestOne(id: number) {
    const subjectId = Number(id);
    if (!subjectId) {
      throw new BusinessException(500, '专栏不存在');
    }

    const subject = await this.postSubjectRepository.findOne({
      where: { id: subjectId, delFlag: '0', status: '0', publishStatus: PublishStatusEnum.PUBLISHED },
      select: ['id', 'title', 'desc', 'userId', 'cover', 'author', 'createTime'],
    });

    if (!subject) {
      throw new BusinessException(500, '专栏不存在');
    }

    const articleCount = await this.countGuestArticles(subjectId);

    return ResultData.ok({ ...subject, articleCount });
  }

  async update(updateDto: UpdatePostSubjectDto) {
    const { id, ...updateData } = updateDto;
    const subject = await this.postSubjectRepository.findOne({ where: { id, delFlag: '0' } });

    if (!subject) {
      throw new BusinessException(500, '专栏不存在');
    }

    await this.postSubjectRepository.update({ id }, updateData);
    return ResultData.ok();
  }

  async remove(ids: number | number[]) {
    // 统一转换为数组
    const idList = Array.isArray(ids) ? ids : [ids];

    if (!idList || idList.length === 0) {
      throw new BusinessException(400, '请选择要删除的专栏');
    }

    // 获取所有要删除的专栏
    const subjects = await this.postSubjectRepository.find({
      where: {
        id: In(idList),
        delFlag: '0',
      },
    });

    if (subjects.length === 0) {
      throw new BusinessException(500, '未找到可删除的专栏');
    }

    // 批量软删除
    await this.postSubjectRepository.update({ id: In(idList) }, { delFlag: '1' });

    return ResultData.ok();
  }
}
