import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ResultData } from 'src/common/utils/result';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { applyLike, assertOwnership, attachUserInfo, paginate } from 'src/common/query';
import { PostArticleEntity } from './entities/article.entity';
import { CreatePostArticleDto, UpdatePostArticleDto, ListPostArticleDto, AuditPostArticleDto, PublishStatusEnum, AuditStatusEnum } from './dto/index';
import { UserDto } from 'src/module/system/user/user.decorator';
import { UserEntity } from 'src/module/system/user/entities/sys-user.entity';

/**
 * 文章服务类
 * 提供文章的增删改查、审核等功能
 */
@Injectable()
export class PostArticleService {
  constructor(
    @InjectRepository(PostArticleEntity)
    private readonly postArticleRepository: Repository<PostArticleEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}

  /**
   * 创建文章
   * @param createDto 创建文章的数据
   * @param user 当前登录用户信息
   * @returns 操作结果
   */
  async create(createDto: CreatePostArticleDto, user: UserDto) {
    // 从当前登录用户信息中获取 userId
    const userId = user.user.userId;

    // 数据验证：检查描述字段是否过长或重复
    if (createDto.desc && createDto.desc.length > 255) {
      console.warn('⚠️ [创建文章] 描述字段过长，已截断');
      createDto.desc = createDto.desc.substring(0, 255);
    }

    // 创建文章实体，并设置 userId（强制覆盖前端传来的任何userId）；未选专栏存 0 表示未归类
    const article = this.postArticleRepository.create({
      ...createDto,
      subjectId: createDto.subjectId ?? 0,
      userId: userId, // 这里会覆盖 createDto 中可能存在的 userId
    });

    // 状态/计数一律服务端写死，不信任请求体（相关字段已从 DTO 移除，此处再兜底覆盖一次）：
    // 保留前台发文免审流程——直接已发布并落发布时间；audit_status 与 init.sql 默认值一致（0 未提交），
    // 走人工审核流转需经 /audit 端点；计数只能由点赞/评论/浏览事务维护，禁止客户端指定
    article.publishStatus = PublishStatusEnum.PUBLISHED;
    article.auditStatus = AuditStatusEnum.NOT_SUBMITTED;
    article.publishTime = new Date();
    article.likeNum = 0;
    article.readNum = 0;
    article.commentNum = 0;

    await this.postArticleRepository.save(article);
    return ResultData.ok({ id: article.id });
  }

  /**
   * 查询文章列表（支持分页和条件筛选）
   * @param query 查询参数
   * @returns 文章列表和总数
   */
  async findAll(query: ListPostArticleDto) {
    const entity = this.buildListQuery(query, false);
    const [list, total] = await entity.getManyAndCount();

    // 批量为文章关联查询用户信息（一次 IN 查询替代逐行 findOne）
    const processedList = await attachUserInfo(list, this.userRepository);

    return ResultData.ok({
      list: processedList,
      total,
    });
  }

  /**
   * 查询文章详情
   * @param id 文章ID
   * @returns 文章详情
   */
  async findOne(id: number) {
    // 先查询文章基本信息
    const article = await this.postArticleRepository.findOne({
      where: { id, delFlag: '0' },
    });

    if (!article) {
      throw new BusinessException(500, '文章不存在');
    }

    // 根据文章中的 userId 查询用户详细信息
    const user = await this.userRepository.findOne({
      where: { userId: article.userId },
      select: ['userId', 'userName', 'nickName', 'avatar'],
    });

    // 处理可能的空值并提供默认值
    const processedArticle = {
      ...article,
      content: article.content || '',
      author: article.author || (user ? user.nickName : ''),
      publishTime: article.publishTime || null,
      userInfo: user
        ? {
            userId: user.userId,
            userName: user.userName,
            nickName: user.nickName,
            avatar: user.avatar || '',
          }
        : null,
    };

    // 将用户信息附加到文章数据中返回
    return ResultData.ok(processedArticle);
  }

  /**
   * 校验字段是否为文章实体的合法属性（防止 ORDER BY 注入）
   */
  private isArticleField(field: string): boolean {
    return this.postArticleRepository.metadata.columns.some((column) => column.propertyName === field);
  }

  /**
   * 构建文章列表查询（findAll/findGuestAll 公共部分，合并原先两套复制的 where 构造）：
   * where 条件、排序、分页收口为一处。
   * guest 版差异：仅 select 公开列（不含审核信息等内部数据）、写死仅返回已发布、
   * 不接收 publishStatus/auditStatus 查询参数、默认按发布时间倒序
   * @param guest true 游客版 / false 管理端版
   */
  private buildListQuery(query: ListPostArticleDto, guest: boolean) {
    const entity = this.postArticleRepository.createQueryBuilder('article');

    // 游客版仅返回公开列，不包含审核信息等内部数据
    if (guest) {
      entity.select([
        'article.id',
        'article.title',
        'article.desc',
        'article.subjectId',
        'article.userId',
        'article.cover',
        'article.author',
        'article.source',
        'article.publishTime',
        'article.likeNum',
        'article.readNum',
        'article.commentNum',
        'article.createTime',
      ]);
    }

    entity.where('article.delFlag = :delFlag', { delFlag: '0' });

    // 游客版仅返回已发布文章
    if (guest) {
      entity.andWhere('article.publishStatus = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED });
    }

    // 按标题模糊搜索
    applyLike(entity, 'article.title', query.title);

    // 按专栏ID筛选
    if (query.subjectId) {
      entity.andWhere('article.subjectId = :subjectId', { subjectId: query.subjectId });
    }

    // 按作者ID筛选
    if (query.userId) {
      entity.andWhere('article.userId = :userId', { userId: query.userId });
    }

    // 按发布/审核状态筛选（仅管理端查询参数，游客版不接收这两个过滤条件）
    if (!guest) {
      if (query.publishStatus) {
        entity.andWhere('article.publishStatus = :publishStatus', { publishStatus: query.publishStatus });
      }

      if (query.auditStatus) {
        entity.andWhere('article.auditStatus = :auditStatus', { auditStatus: query.auditStatus });
      }
    }

    // 按文章来源筛选
    if (query.source) {
      entity.andWhere('article.source = :source', { source: query.source });
    }

    // 排序（校验排序字段是否为文章实体的合法属性，防止 ORDER BY 注入）；游客版默认按发布时间倒序
    if (query.orderByColumn && query.isAsc && this.isArticleField(query.orderByColumn)) {
      const key = query.isAsc === 'ascending' ? 'ASC' : 'DESC';
      entity.orderBy(`article.${query.orderByColumn}`, key);
    } else if (guest) {
      entity.orderBy('article.publishTime', 'DESC');
    }

    // 分页
    return paginate(entity, query);
  }

  /**
   * 查询文章列表（游客，仅返回已发布文章，不包含审核信息等内部数据）
   * @param query 查询参数
   * @returns 文章列表和总数
   */
  async findGuestAll(query: ListPostArticleDto) {
    const entity = this.buildListQuery(query, true);
    const [list, total] = await entity.getManyAndCount();

    // 批量为文章关联查询作者公开信息（仅昵称与头像，一次 IN 查询替代逐行 findOne）
    const processedList = await attachUserInfo(list, this.userRepository);

    return ResultData.ok({
      list: processedList,
      total,
    });
  }

  /**
   * 查询文章详情（游客，仅返回已发布文章，不包含审核信息等内部数据）
   * @param id 文章ID
   * @returns 文章详情
   */
  async findGuestOne(id: number) {
    const articleId = Number(id);
    if (!articleId) {
      throw new BusinessException(500, '文章不存在');
    }

    const article = await this.postArticleRepository.findOne({
      where: { id: articleId, delFlag: '0', publishStatus: PublishStatusEnum.PUBLISHED },
      select: [
        'id',
        'title',
        'desc',
        'subjectId',
        'userId',
        'content',
        'cover',
        'author',
        'source',
        'publishTime',
        'likeNum',
        'readNum',
        'commentNum',
        'createTime',
      ],
    });

    if (!article) {
      throw new BusinessException(500, '文章不存在');
    }

    // 根据文章中的 userId 查询作者公开信息（仅昵称与头像，不暴露登录名）
    const user = await this.userRepository.findOne({
      where: { userId: article.userId },
      select: ['userId', 'nickName', 'avatar'],
    });

    const processedArticle = {
      ...article,
      content: article.content || '',
      author: article.author || (user ? user.nickName : ''),
      publishTime: article.publishTime || null,
      userInfo: user
        ? {
            userId: user.userId,
            nickName: user.nickName,
            avatar: user.avatar || '',
          }
        : null,
    };

    return ResultData.ok(processedArticle);
  }

  /**
   * 记录一次阅读（游客端详情页打开时调用）
   * 仅已发布未删除文章可计；原子自增避免并发丢失，返回自增后的最新阅读数
   */
  async recordRead(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BusinessException(400, '文章ID不合法');
    }

    const updated = await this.postArticleRepository
      .createQueryBuilder()
      .update(PostArticleEntity)
      .set({ readNum: () => 'read_num + 1' })
      .where('id = :id', { id })
      .andWhere('del_flag = :delFlag', { delFlag: '0' })
      .andWhere('publish_status = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED })
      .execute();

    if (!updated.affected) {
      throw new BusinessException(500, '文章不存在或未发布');
    }

    const fresh = await this.postArticleRepository.findOne({ where: { id }, select: ['readNum'] });
    return ResultData.ok({ readNum: fresh?.readNum ?? 0 });
  }

  /**
   * 更新文章
   * @param updateDto 更新数据
   * @param user 当前登录用户信息
   * @returns 操作结果
   */
  async update(updateDto: UpdatePostArticleDto, user: UserDto) {
    const { id, ...updateData } = updateDto;

    const article = await this.postArticleRepository.findOne({
      where: { id, delFlag: '0' },
    });

    if (!article) {
      throw new BusinessException(500, '文章不存在');
    }

    // 权限验证：只能更新自己的文章（管理员除外）
    if (!assertOwnership(user, article)) {
      throw new BusinessException(403, '无权修改此文章');
    }

    // 确保不会更新 userId 字段；状态/计数列也不允许经通用更新修改——
    // publishStatus 只能经 /publish/:id 端点流转，auditStatus 只能经 /audit 端点流转，
    // publishTime 随发布端点落值，计数由点赞/评论事务维护（相关字段也已从 DTO 移除，双重兜底）
    const { userId, likeNum, readNum, commentNum, publishStatus, auditStatus, publishTime, ...safeUpdateData } = updateData as any;

    // 数据验证：检查描述字段是否过长
    if (safeUpdateData.desc && safeUpdateData.desc.length > 255) {
      console.warn('⚠️ [更新文章] 描述字段过长，已截断');
      safeUpdateData.desc = safeUpdateData.desc.substring(0, 255);
    }

    await this.postArticleRepository.update({ id }, safeUpdateData);
    return ResultData.ok();
  }

  /**
   * 删除文章（软删除，支持单个或多个）
   * @param ids 文章ID或ID数组
   * @param user 当前登录用户信息
   * @returns 操作结果
   */
  async remove(ids: number | number[], user: UserDto) {
    // 统一转换为数组
    const idList = Array.isArray(ids) ? ids : [ids];

    if (!idList || idList.length === 0) {
      throw new BusinessException(400, '请选择要删除的文章');
    }

    // 获取所有要删除的文章
    const articles = await this.postArticleRepository.find({
      where: {
        id: In(idList),
        delFlag: '0',
      },
    });

    if (articles.length === 0) {
      throw new BusinessException(500, '未找到可删除的文章');
    }

    // 权限验证：只能删除自己的文章（管理员除外）；检查是否有不属于当前用户的文章
    const unauthorizedArticles = articles.filter((article) => !assertOwnership(user, article));
    if (unauthorizedArticles.length > 0) {
      throw new BusinessException(403, '无权删除部分文章');
    }

    // 批量软删除
    await this.postArticleRepository.update({ id: In(idList) }, { delFlag: '1' });

    return ResultData.ok();
  }

  /**
   * 审核文章
   * @param auditDto 审核数据
   * @param auditUserId 审核人ID
   * @returns 操作结果
   */
  async audit(auditDto: AuditPostArticleDto, auditUserId: number) {
    const article = await this.postArticleRepository.findOne({
      where: { id: auditDto.id, delFlag: '0' },
    });

    if (!article) {
      throw new BusinessException(500, '文章不存在');
    }

    // 更新审核状态、审核人、审核时间和备注
    await this.postArticleRepository.update(
      { id: auditDto.id },
      {
        auditStatus: auditDto.auditStatus,
        auditUserId,
        auditTime: new Date(),
        auditRemark: auditDto.auditRemark || null,
      },
    );

    return ResultData.ok();
  }

  /**
   * 提交审核（将文章状态改为审核中）
   * @param id 文章ID
   * @param user 当前登录用户信息
   * @returns 操作结果
   */
  async submitForAudit(id: number, user: UserDto) {
    const article = await this.postArticleRepository.findOne({
      where: { id, delFlag: '0' },
    });

    if (!article) {
      throw new BusinessException(500, '文章不存在');
    }

    // 权限验证：只能提交自己的文章进行审核
    if (!assertOwnership(user, article)) {
      throw new BusinessException(403, '无权操作此文章');
    }

    await this.postArticleRepository.update(
      { id },
      {
        auditStatus: '1', // 审核中
      },
    );

    return ResultData.ok();
  }

  /**
   * 发布文章（将待发布的文章改为已发布）
   * @param id 文章ID
   * @param user 当前登录用户信息
   * @returns 操作结果
   */
  async publish(id: number, user: UserDto) {
    const article = await this.postArticleRepository.findOne({
      where: { id, delFlag: '0' },
    });

    if (!article) {
      throw new BusinessException(500, '文章不存在');
    }

    // 权限验证：只能发布自己的文章（管理员除外）
    if (!assertOwnership(user, article)) {
      throw new BusinessException(403, '无权发布此文章');
    }

    await this.postArticleRepository.update(
      { id },
      {
        publishStatus: '2', // 已发布
        publishTime: new Date(),
      },
    );

    return ResultData.ok();
  }
}
