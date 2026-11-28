import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ResultData } from 'src/common/utils/result';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { applyLike, assertOwnership, attachUserInfo, hasPermission, paginate } from 'src/common/query';
import { ReportStatusEnum } from '@nest-acticle/shared';
import { StatusEnum } from 'src/common/enum/index';
import { PostArticleEntity } from './entities/article.entity';
import { CreatePostArticleDto, UpdatePostArticleDto, ListPostArticleDto, AuditPostArticleDto, PublishStatusEnum, AuditStatusEnum } from './dto/index';
import { UserDto } from 'src/module/system/user/user.decorator';
import { UserEntity } from 'src/module/system/user/entities/sys-user.entity';
import { PostReportEntity } from '../report/entities/report.entity';
import { PostFollowEntity } from '../follow/entities/follow.entity';
import { AUTO_OFFLINE_REPORTERS } from '../report/report.service';
import { SysNoticeEntity } from 'src/module/system/notice/entities/notice.entity';
import { RedisService } from 'src/module/common/redis/redis.service';

/**
 * 阅读上报防刷：同一 IP 对同一文章在窗口内只计一次
 * key 形如 read:dedup:{articleId}:{ip}；TTL 单位秒（SET EX），窗口 24 小时
 */
const READ_DEDUP_KEY_PREFIX = 'read:dedup:';
const READ_DEDUP_EXPIRES_SECONDS = 24 * 60 * 60;

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
    @InjectRepository(PostReportEntity)
    private readonly reportRepo: Repository<PostReportEntity>,
    private readonly redisService: RedisService,
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
   * guest 版差异：仅 select 公开列（不含审核信息等内部数据）、默认仅返回已发布、
   * 不接收 publishStatus/auditStatus 查询参数、默认按发布时间倒序
   * @param guest true 游客版 / false 管理端版
   * @param selfView 游客版的本人视角：空间主人看自己的空间时，已发布 + 已下架都可见
   *                 （草稿仍只在创作者中心；访客维持仅已发布，不泄露下架文章存在性）
   * @param followedBy 关注 feed 视角的当前用户：传入时 inner join post_follow，只取我关注的作者，
   *                   且排序固定为发布时间倒序（不接受客户端指定排序字段）
   */
  private buildListQuery(query: ListPostArticleDto, guest: boolean, selfView = false, followedBy?: number) {
    const entity = this.postArticleRepository.createQueryBuilder('article');

    // 游客版仅返回公开列，不包含审核信息等内部数据（publishStatus 供本人视角渲染「已下架」标）
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
        'article.publishStatus',
        'article.publishTime',
        'article.likeNum',
        'article.readNum',
        'article.commentNum',
        'article.createTime',
      ]);
    }

    entity.where('article.delFlag = :delFlag', { delFlag: '0' });

    // 关注 feed：只取我关注的作者发布的文章。post_follow 对 (follower_id, following_id) 唯一，
    // inner join 不会产生重复行；未关注任何人时 join 结果为空，由前端引导去关注
    if (followedBy) {
      entity.innerJoin(
        PostFollowEntity,
        'follow',
        'follow.followingId = article.userId AND follow.followerId = :feedFollowerId',
        { feedFollowerId: followedBy },
      );
    }

    // 游客版默认仅返回已发布文章；本人视角放宽到已发布 + 已下架
    if (guest) {
      if (selfView) {
        entity.andWhere('article.publishStatus IN (:...statuses)', {
          statuses: [PublishStatusEnum.PUBLISHED, PublishStatusEnum.OFFLINE],
        });
      } else {
        entity.andWhere('article.publishStatus = :publishStatus', { publishStatus: PublishStatusEnum.PUBLISHED });
      }
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
    // 关注 feed 固定 publishTime DESC + id DESC 兜底：发布时间的秒级同秒值在 skip/take 下会漏/重，
    // id 作为稳定次序保证翻页不重不漏
    if (followedBy) {
      entity.orderBy('article.publishTime', 'DESC').addOrderBy('article.id', 'DESC');
    } else if (query.orderByColumn && query.isAsc && this.isArticleField(query.orderByColumn)) {
      const key = query.isAsc === 'ascending' ? 'ASC' : 'DESC';
      entity.orderBy(`article.${query.orderByColumn}`, key);
    } else if (guest) {
      entity.orderBy('article.publishTime', 'DESC');
    }

    // 分页
    return paginate(entity, query);
  }

  /**
   * 查询文章列表（游客，默认仅返回已发布文章，不包含审核信息等内部数据）
   * 带登录态且访问的是自己的空间（userId = 本人）时，已下架文章一并返回（本人可见性口径，
   * 与 guest/detail 的作者可见一致）；其他访问者维持仅已发布
   * @param query 查询参数
   * @param viewer 访问者登录态（可空）
   * @returns 文章列表和总数
   */
  async findGuestAll(query: ListPostArticleDto, viewer?: UserDto) {
    const selfView = !!viewer?.userId && query.userId === viewer.userId;
    const entity = this.buildListQuery(query, true, selfView);
    const [list, total] = await entity.getManyAndCount();

    // 批量为文章关联查询作者公开信息（仅昵称与头像，一次 IN 查询替代逐行 findOne）
    const processedList = await attachUserInfo(list, this.userRepository);

    return ResultData.ok({
      list: processedList,
      total,
    });
  }

  /**
   * 我的文章列表（登录用户，服务端强制 userId=本人）：创作者中心文章管理数据源
   * 与管理端 /list 的差异：不挂权限串（member 注册用户没有 post:article:list）且只能查自己；
   * 全状态可见（草稿/审核中/已发布/已下架），含审核字段（自己的数据无泄露问题）
   */
  async findMyAll(query: ListPostArticleDto, user: UserDto) {
    // 覆盖查询参数里的 userId：只能查自己的，请求体指定他人 userId 无效
    query.userId = user.userId;
    const entity = this.buildListQuery(query, false);
    const [list, total] = await entity.getManyAndCount();

    const processedList = await attachUserInfo(list, this.userRepository);

    return ResultData.ok({
      list: processedList,
      total,
    });
  }

  /**
   * 关注 feed（登录用户）：我关注的作者发布的文章，按发布时间倒序（同秒以 id 兜底）
   * 口径与游客列表一致：仅已发布、未删除，返回公开列；未关注任何作者时返回空列表
   */
  async findFollowAll(query: ListPostArticleDto, user: UserDto) {
    const entity = this.buildListQuery(query, true, false, user.userId);
    const [list, total] = await entity.getManyAndCount();

    const processedList = await attachUserInfo(list, this.userRepository);

    return ResultData.ok({
      list: processedList,
      total,
    });
  }

  /**
   * 查询文章详情（游客，仅返回已发布文章，不包含审核信息等内部数据）
   * 已下架文章对作者本人与后台角色（post:article:edit 权限）开放：
   * 接口带有效 token 时 guard 会填充 user（NotRequireAuth 可选鉴权口径），据此判定可见性；
   * 访客访问非已发布文章维持「不存在」，不泄露下架/草稿的存在性
   * @param id 文章ID
   * @param viewer 访问者登录态（可空）
   * @returns 文章详情
   */
  async findGuestOne(id: number, viewer?: UserDto) {
    const articleId = Number(id);
    if (!articleId) {
      throw new BusinessException(500, '文章不存在');
    }

    const article = await this.postArticleRepository.findOne({
      where: { id: articleId, delFlag: '0' },
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
        'publishStatus',
        'publishTime',
        'likeNum',
        'readNum',
        'commentNum',
        'collectNum',
        'createTime',
      ],
    });

    if (!article) {
      throw new BusinessException(500, '文章不存在');
    }

    // 非已发布文章仅作者本人与后台角色可见；publishStatus 随行返回，前端据此出「已下架」横幅
    if (article.publishStatus !== PublishStatusEnum.PUBLISHED) {
      const allowed = (viewer?.userId && article.userId === viewer.userId) || hasPermission(viewer, 'post:article:edit');
      if (!allowed) {
        throw new BusinessException(500, '文章不存在');
      }
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
   * 防刷：同一 IP 对同一文章 24 小时内只计一次——先 SET NX EX 原子占键，占键成功才自增，
   * 并发重复请求只有一个能占到键；占键失败即重复上报，静默返回 ok（不增量、不报错，客户端无感）。
   * 文章不存在/未发布时首次仍照常报错，键随之占住，重复请求同样静默返回、不再查库
   * @param id 文章ID
   * @param ip 客户端 IP（去重维度）
   */
  async recordRead(id: number, ip: string) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new BusinessException(400, '文章ID不合法');
    }

    const acquired = await this.redisService
      .getClient()
      .set(`${READ_DEDUP_KEY_PREFIX}${id}:${ip}`, 1, 'EX', READ_DEDUP_EXPIRES_SECONDS, 'NX');
    if (!acquired) {
      return ResultData.ok();
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

    // 确保不会更新 userId 字段；计数列不允许经通用更新修改（点赞/评论事务维护，DTO 已双重兜底）
    const { userId, likeNum, readNum, commentNum, publishStatus, auditStatus, publishTime, ...safeUpdateData } = updateData as any;

    // 状态字段有条件放开（管理端抽屉/创作者中心上下架共用本端点）：
    // - publishStatus：具备 post:article:publish 权限的角色（管理员/编辑）可任意流转；
    //   无权限的作者仅能对「自己的文章」做已发布↔已下架自管理——因举报被下架的文章不能自行恢复发布，
    //   防止作者绕过举报处置（有成立的举报下架记录即拦截，申诉走管理员）
    // - auditStatus：仅 post:article:audit 权限可改
    // publishTime 依旧服务端落值（重新发布时补当前时间），不接受请求体指定
    const statusUpdate: Partial<PostArticleEntity> = {};
    const hasPublishPerm = hasPermission(user, 'post:article:publish');
    if (publishStatus !== undefined && publishStatus !== article.publishStatus) {
      if (!hasPublishPerm) {
        const isOwner = article.userId === user.user?.userId;
        if (!isOwner) {
          throw new BusinessException(403, '无权变更发布状态');
        }
        if (![PublishStatusEnum.PUBLISHED, PublishStatusEnum.OFFLINE].includes(publishStatus)) {
          throw new BusinessException(500, '仅支持发布/下架状态切换');
        }
        // 只放行已发布↔已下架：草稿/待发布/审核中经通用更新改「已发布」会绕过发布与审核端点
        const isOfflineAction = publishStatus === PublishStatusEnum.OFFLINE && article.publishStatus === PublishStatusEnum.PUBLISHED;
        const isRepublishAction = publishStatus === PublishStatusEnum.PUBLISHED && article.publishStatus === PublishStatusEnum.OFFLINE;
        if (!isOfflineAction && !isRepublishAction) {
          throw new BusinessException(500, '仅支持已发布↔已下架切换');
        }
        if (isRepublishAction) {
          const reported = await this.reportRepo.findOne({
            where: { targetType: 'post', targetId: id, status: ReportStatusEnum.UPHELD, handleAction: 'unpublish' },
            select: ['id'],
          });
          if (reported) {
            throw new BusinessException(403, '该文章因举报已下架，如需恢复发布请联系管理员申诉');
          }
          // 因大量举报被自动下架的文章同样不允许作者自行恢复（复核前防反复横跳），口径与 report.service 阈值一致
          const pendingRows: Array<{ cnt: string }> = await this.reportRepo.query(
            'SELECT COUNT(DISTINCT reporter_id) AS cnt FROM post_report WHERE target_type = ? AND target_id = ? AND status = ?',
            ['post', id, ReportStatusEnum.PENDING],
          );
          if (Number(pendingRows[0]?.cnt || 0) >= AUTO_OFFLINE_REPORTERS) {
            throw new BusinessException(403, '该文章被大量用户举报待复核，如需恢复发布请联系管理员');
          }
        }
      }
      statusUpdate.publishStatus = publishStatus;
      if (publishStatus === PublishStatusEnum.PUBLISHED && !article.publishTime) {
        statusUpdate.publishTime = new Date();
      }
    }
    if (auditStatus !== undefined && auditStatus !== article.auditStatus && hasPermission(user, 'post:article:audit')) {
      statusUpdate.auditStatus = auditStatus;
    }

    // 数据验证：检查描述字段是否过长
    if (safeUpdateData.desc && safeUpdateData.desc.length > 255) {
      console.warn('⚠️ [更新文章] 描述字段过长，已截断');
      safeUpdateData.desc = safeUpdateData.desc.substring(0, 255);
    }

    // 无 publish 权限的作者自管理分支（发布↔下架自流转）：条件更新防 check-then-act 竞态——
    // 读取后文章被并发自动下架/管理员流转（publish_status 已非读取值）时 affected=0 直接失败，
    // 重试会重新走上方举报拦截与阈值检查，不会绕过（有 publish 权限的管理分支维持通用更新）
    if (statusUpdate.publishStatus !== undefined && !hasPublishPerm) {
      const res = await this.postArticleRepository.update(
        { id, publishStatus: article.publishStatus },
        { ...safeUpdateData, ...statusUpdate },
      );
      if (!res.affected) {
        throw new BusinessException(500, '文章状态已变化，请刷新后重试');
      }
    } else {
      await this.postArticleRepository.update({ id }, { ...safeUpdateData, ...statusUpdate });
    }

    // 恢复上架通知：管理端角色把已下架文章重新发布时，定向通知作者（sys_notice type=3 举报反馈通道）。
    // 作者自行恢复（无 publish 权限的自管理路径）不发——自己的动作自己知道
    if (
      statusUpdate.publishStatus === PublishStatusEnum.PUBLISHED &&
      article.publishStatus === PublishStatusEnum.OFFLINE &&
      hasPermission(user, 'post:article:publish') &&
      article.userId !== user.userId
    ) {
      try {
        await this.postArticleRepository.manager.insert(SysNoticeEntity, {
          noticeTitle: `你的文章《${article.title}》已恢复发布`,
          noticeType: '3',
          noticeContent: `你的文章《${article.title}》已由管理员恢复发布，现已对外可见。感谢你的理解与支持。`,
          userId: article.userId,
          status: StatusEnum.NORMAL,
          createBy: 'system',
        });
      } catch (error) {
        // 通知写入失败不阻断恢复发布的结果（文章状态已落库），仅记日志
        console.error(`[更新文章] 恢复发布通知写入失败 article=${id} author=${article.userId}`, error);
      }
    }

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
