import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ResultData } from 'src/common/utils/result';
import { BusinessException } from 'src/common/exceptions/business.exception';
import { applyLike, paginate } from 'src/common/query';
import { PostFollowEntity } from './entities/follow.entity';
import { FollowListTypeEnum, ListFollowDto, ListGuestFollowDto, ListMyFollowDto } from './dto/index';
import { UserEntity } from 'src/module/system/user/entities/sys-user.entity';

/**
 * 访问者对某用户的关注状态（列表条目按钮三态）
 * none=未关注 following=已关注 mutual=互相关注
 */
export type ViewerFollowState = 'none' | 'following' | 'mutual';

/**
 * 关注服务
 * 写路径（关注/取消/管理删除）统一走事务；fan_num/follow_num 不落冗余计数列，
 * 展示侧读时 COUNT（follower_id/following_id 两方向唯一/普通索引，博客量级下索引 COUNT 微秒级）
 */
@Injectable()
export class PostFollowService {
  private readonly logger = new Logger(PostFollowService.name);

  constructor(
    @InjectRepository(PostFollowEntity)
    private readonly followRepo: Repository<PostFollowEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * 关注（幂等：已关注直接返回当前状态）
   * 禁止关注自己；参数化 INSERT IGNORE + 唯一索引：并发重复关注静默忽略（同点赞口径）
   */
  async follow(followingId: number, userId: number) {
    if (followingId === userId) {
      throw new BusinessException(500, '不能关注自己');
    }

    return this.userRepo.manager.transaction(async (manager) => {
      const target = await manager.findOne(UserEntity, { where: { userId: followingId } });
      if (!target) {
        throw new BusinessException(500, '用户不存在');
      }

      // 参数化 INSERT IGNORE + 唯一索引：并发重复关注静默忽略，天然幂等（affectedRows=0 表示已关注过，
      // 与新插入状态一致都是已关注，不需要回读区分）
      await manager.query('INSERT IGNORE INTO post_follow (follower_id, following_id) VALUES (?, ?)', [
        userId,
        followingId,
      ]);

      const fanNum = await manager.count(PostFollowEntity, { where: { followingId } });
      return ResultData.ok({ followed: true, fanNum });
    });
  }

  /**
   * 取消关注（幂等：未关注直接返回当前状态）
   */
  async unfollow(followingId: number, userId: number) {
    return this.userRepo.manager.transaction(async (manager) => {
      await manager.delete(PostFollowEntity, { followerId: userId, followingId });
      const fanNum = await manager.count(PostFollowEntity, { where: { followingId } });
      return ResultData.ok({ followed: false, fanNum });
    });
  }

  /**
   * 当前用户对目标用户的关注状态（含互关标记与对方粉丝数）
   */
  async status(followingId: number, userId: number) {
    const followed = !!(await this.followRepo.findOne({
      where: { followerId: userId, followingId },
      select: ['id'],
    }));
    // 互关只在已关注时才值得查（未关注时互关不成立，少一发查询）
    const mutual = followed
      ? !!(await this.followRepo.findOne({
          where: { followerId: followingId, followingId: userId },
          select: ['id'],
        }))
      : false;
    const fanNum = await this.countFans([followingId]);

    return ResultData.ok({ followed, mutual, fanNum: fanNum.get(followingId) ?? 0 });
  }

  /**
   * 指定用户的关注/粉丝列表（公开：个人空间关注/粉丝栏对访客开放，同掘金）
   * type=following 查空间主人关注的人，type=fans 查关注空间主人的人
   * 带登录态访问时（NotRequireAuth 接口对有效 token 仍会填充 user），逐条回填访问者视角的
   * followState（none/following/mutual），条目按钮三态由此驱动；粉丝数读时 COUNT
   */
  async findGuestList(query: ListGuestFollowDto, viewerId?: number) {
    const isFollowing = query.type === FollowListTypeEnum.FOLLOWING;
    const entity = this.followRepo.createQueryBuilder('follow');
    entity
      .leftJoin(
        UserEntity,
        'user',
        isFollowing ? 'user.userId = follow.followingId' : 'user.userId = follow.followerId',
      )
      .addSelect(['user.userId', 'user.nickName', 'user.avatar', 'user.signature'])
      .where(isFollowing ? 'follow.followerId = :userId' : 'follow.followingId = :userId', { userId: query.userId });

    paginate(entity, query);

    entity.orderBy('follow.createTime', 'DESC');

    const { raw } = await entity.getRawAndEntities();
    const total = await entity.getCount();

    // raw 键格式为「别名_数据库列名」；再批查两份聚合：每人粉丝数 + 访问者视角关注状态
    const list = raw.map((row: Record<string, any>) => ({
      userId: isFollowing ? row.follow_following_id : row.follow_follower_id,
      nickName: row.user_nick_name || '',
      avatar: row.user_avatar || null,
      signature: row.user_signature || null,
      followTime: row.follow_create_time,
      fanNum: 0,
      followState: 'none' as ViewerFollowState,
    }));
    const targetIds = list.map((item) => item.userId);

    const fanNumMap = await this.countFans(targetIds);
    const stateMap = await this.resolveViewerStates(viewerId, targetIds);
    for (const item of list) {
      item.fanNum = fanNumMap.get(item.userId) ?? 0;
      item.followState = stateMap.get(item.userId) ?? 'none';
    }

    return ResultData.ok({ list, total });
  }

  /**
   * 收到的关注（通知中心「新增粉丝」栏：谁关注了我），联关注人公开信息，最新在前
   * follower_id = following_id 的行不出现在任何列表（服务层已禁止自关注，此处为 DB 层兜底）
   * followState 复用统一解析：行本身证明「对方关注我」，我再关注对方即互关，
   * 故取值只会是 none（待回关）/ mutual（已互关），不会出现 following
   */
  async findReceivedList(userId: number, query: ListMyFollowDto) {
    const entity = this.followRepo.createQueryBuilder('follow');
    entity
      .leftJoin(UserEntity, 'user', 'user.userId = follow.followerId')
      .addSelect(['user.nickName', 'user.avatar'])
      .where('follow.followingId = :userId', { userId })
      .andWhere('follow.followerId <> :userId', { userId });

    paginate(entity, query);

    entity.orderBy('follow.createTime', 'DESC');

    const { raw } = await entity.getRawAndEntities();
    const total = await entity.getCount();

    const list = raw.map((row: Record<string, any>) => ({
      id: row.follow_id,
      userId: row.follow_follower_id,
      nickName: row.user_nick_name || '',
      avatar: row.user_avatar || null,
      followTime: row.follow_create_time,
      followState: 'none' as ViewerFollowState,
    }));

    // 回关状态批查：我关注的人里有哪些在本页
    const followerIds = list.map((item) => item.userId);
    const stateMap = await this.resolveViewerStates(userId, followerIds);
    for (const item of list) {
      item.followState = stateMap.get(item.userId) ?? 'none';
    }

    return ResultData.ok({ list, total });
  }

  /**
   * 关注管理列表（管理端，联关注人/被关注人昵称）
   * 取数走 getRawAndEntities：follow 实体 + join 出的两端用户展示列手动拼平
   */
  async findAdminList(query: ListFollowDto) {
    const entity = this.followRepo.createQueryBuilder('follow');
    entity
      .leftJoin(UserEntity, 'follower', 'follower.userId = follow.followerId')
      .leftJoin(UserEntity, 'following', 'following.userId = follow.followingId')
      .addSelect(['follower.nickName', 'following.nickName'])
      .where('1 = 1');

    applyLike(entity, 'follower.nickName', query.followerName);
    applyLike(entity, 'following.nickName', query.followingName);

    if (query.params?.beginTime && query.params?.endTime) {
      entity.andWhere('follow.createTime BETWEEN :start AND :end', {
        start: query.params.beginTime,
        end: query.params.endTime,
      });
    }

    paginate(entity, query);

    entity.orderBy('follow.createTime', 'DESC');

    const { raw } = await entity.getRawAndEntities();
    const total = await entity.getCount();

    // raw 键格式为「别名_数据库列名」（非实体属性名）
    const list = raw.map((row: Record<string, any>) => ({
      id: row.follow_id,
      followerId: row.follow_follower_id,
      followingId: row.follow_following_id,
      createTime: row.follow_create_time,
      followerName: row.follower_nick_name,
      followingName: row.following_nick_name,
    }));

    return ResultData.ok({ list, total });
  }

  /**
   * 管理端批量删除关注记录：纯明细删除，无冗余计数需要回减（读时 COUNT 口径的收益）
   */
  async removeByIds(ids: number[]) {
    return this.followRepo.manager.transaction(async (manager) => {
      const rows = await manager.find(PostFollowEntity, { where: { id: In(ids) } });
      if (!rows.length) {
        return ResultData.ok();
      }

      await manager.delete(PostFollowEntity, { id: In(rows.map((row) => row.id)) });

      this.logger.log(`管理员删除关注记录 ${rows.length} 条`);
      return ResultData.ok();
    });
  }

  /**
   * 批量统计粉丝数：一次 GROUP BY 替代逐人 COUNT（消 N+1），走 idx_following_id 索引
   */
  private async countFans(userIds: number[]): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (!userIds.length) {
      return map;
    }
    const rows: Array<{ fid: number; cnt: string }> = await this.followRepo
      .createQueryBuilder('f')
      .select('f.followingId', 'fid')
      .addSelect('COUNT(*)', 'cnt')
      .where('f.followingId IN (:...userIds)', { userIds })
      .groupBy('f.followingId')
      .getRawMany();
    for (const row of rows) {
      map.set(row.fid, Number(row.cnt));
    }
    return map;
  }

  /**
   * 批量解析访问者视角的关注状态：两方向 IN 批查替代逐人 status（消 N+1）
   * following=访问者→目标存在；mutual=双向存在；未登录一律 none
   */
  private async resolveViewerStates(viewerId: number | undefined, targetIds: number[]): Promise<Map<number, ViewerFollowState>> {
    const map = new Map<number, ViewerFollowState>();
    for (const id of targetIds) {
      map.set(id, 'none');
    }
    if (!viewerId || !targetIds.length) {
      return map;
    }

    const [iFollow, followsMe] = await Promise.all([
      this.followRepo.find({ where: { followerId: viewerId, followingId: In(targetIds) }, select: ['followingId'] }),
      this.followRepo.find({ where: { followingId: viewerId, followerId: In(targetIds) }, select: ['followerId'] }),
    ]);
    const iFollowSet = new Set(iFollow.map((row) => row.followingId));
    const followsMeSet = new Set(followsMe.map((row) => row.followerId));

    for (const id of targetIds) {
      if (iFollowSet.has(id)) {
        map.set(id, followsMeSet.has(id) ? 'mutual' : 'following');
      }
    }
    return map;
  }
}
